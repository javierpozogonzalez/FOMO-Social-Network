-- 46-event-messaging-system.sql
-- Sistema de mensajería para eventos: anuncios del organizador + chat de asistentes
-- Incluye rate limiting, filtro de contenido, moderación y límites por plan

-- ============================================================================
-- 1) TABLAS
-- ============================================================================

-- 1.1) Anuncios del organizador (fijados arriba, visualmente distintos)
CREATE TABLE IF NOT EXISTS public.event_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_pinned boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_event_announcements_event ON public.event_announcements(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_announcements_organizer ON public.event_announcements(organizer_id);

-- 1.2) Mensajes del chat (asistentes confirmados)
CREATE TABLE IF NOT EXISTS public.event_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_by uuid REFERENCES public.users(id),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_event_chat_messages_event ON public.event_chat_messages(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_chat_messages_user ON public.event_chat_messages(user_id);

-- 1.3) Rate limiting: registro de mensajes recientes por usuario
CREATE TABLE IF NOT EXISTS public.chat_rate_limits (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  message_sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id, message_sent_at)
);

CREATE INDEX IF NOT EXISTS idx_chat_rate_limits_user_event ON public.chat_rate_limits(user_id, event_id, message_sent_at DESC);

-- 1.4) Reportes de mensajes (moderación colaborativa)
CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.event_chat_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reports_message ON public.message_reports(message_id);

-- ============================================================================
-- 2) FUNCIONES AUXILIARES
-- ============================================================================

-- 2.1) Obtener límite de anuncios según el plan del organizador
CREATE OR REPLACE FUNCTION public.get_announcement_limit_from_plan(p_user_id uuid)
RETURNS int LANGUAGE plpgsql STABLE AS $$
DECLARE
  plan_name text;
BEGIN
  SELECT visual_plan INTO plan_name
  FROM public.get_effective_venue_plan(p_user_id);

  -- premium => NULL (ilimitado)
  IF lower(COALESCE(plan_name,'')) = 'premium' THEN
    RETURN NULL;
  END IF;

  RETURN CASE lower(COALESCE(plan_name, ''))
    WHEN 'free' THEN 2
    WHEN 'pro' THEN 6
    ELSE 0
  END;
END $$;

-- 2.2) Contar anuncios actuales de un evento
CREATE OR REPLACE FUNCTION public.count_event_announcements(p_event_id uuid)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int
  FROM public.event_announcements
  WHERE event_id = p_event_id;
$$;

-- 2.3) Validar si el usuario puede crear anuncios (es organizador y no excede límite)
CREATE OR REPLACE FUNCTION public.can_create_announcement(p_user_id uuid, p_event_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  organizer_id uuid;
  limit_ int;
  current_count int;
BEGIN
  -- Verificar que es el organizador del evento
  SELECT e.venue_id INTO organizer_id
  FROM public.events e
  JOIN public.users u ON u.venue_id = e.venue_id
  WHERE e.id = p_event_id AND u.id = p_user_id;
  
  IF organizer_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Obtener límite según plan
  limit_ := public.get_announcement_limit_from_plan(p_user_id);
  
  -- Si es NULL (premium), ilimitado
  IF limit_ IS NULL THEN
    RETURN true;
  END IF;
  
  -- Contar anuncios existentes
  current_count := public.count_event_announcements(p_event_id);
  
  RETURN current_count < limit_;
END $$;

-- 2.4) Validar si el usuario está apuntado al evento (cualquier status excepto cancelado)
CREATE OR REPLACE FUNCTION public.is_event_attendee(p_user_id uuid, p_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_attendees
    WHERE user_id = p_user_id
      AND event_id = p_event_id
      AND status != 'cancelled'
  );
$$;

-- 2.5) Validar rate limiting (3 mensajes/minuto, 20 mensajes/hora)
CREATE OR REPLACE FUNCTION public.check_chat_rate_limit(p_user_id uuid, p_event_id uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  count_last_minute int;
  count_last_hour int;
BEGIN
  -- Limpiar registros antiguos (>1 hora)
  DELETE FROM public.chat_rate_limits
  WHERE message_sent_at < now() - interval '1 hour';
  
  -- Contar mensajes en el último minuto
  SELECT count(*) INTO count_last_minute
  FROM public.chat_rate_limits
  WHERE user_id = p_user_id
    AND event_id = p_event_id
    AND message_sent_at > now() - interval '1 minute';
  
  IF count_last_minute >= 3 THEN
    RETURN false;  -- Excede 3 mensajes/minuto
  END IF;
  
  -- Contar mensajes en la última hora
  SELECT count(*) INTO count_last_hour
  FROM public.chat_rate_limits
  WHERE user_id = p_user_id
    AND event_id = p_event_id
    AND message_sent_at > now() - interval '1 hour';
  
  IF count_last_hour >= 20 THEN
    RETURN false;  -- Excede 20 mensajes/hora
  END IF;
  
  RETURN true;
END $$;

-- 2.6) Filtro de contenido: detectar palabras prohibidas, spam, CAPS excesivo
CREATE OR REPLACE FUNCTION public.filter_message_content(p_content text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  content_lower text := lower(trim(p_content));
  caps_ratio numeric;
  -- Lista de palabras prohibidas (español)
  banned_words text[] := ARRAY[
    'puto','puta','cabrón','cabron','gilipollas','hijo de puta','hdp','mierda','joder',
    'coño','cojon','tonto del culo','imbécil','imbecil','idiota','subnormal','retrasado',
    'maricón','maricon','bollera','travelo','sidoso','drogadicto','yonki','negro de mierda',
    'moro','sudaca','chino de mierda','violación','violar','matar','pegar','hostia',
    'spam','comprar','oferta','gratis','click aquí','descuento','promoción','visita mi perfil'
  ];
  word text;
BEGIN
  -- 1) Validar longitud
  IF char_length(content_lower) = 0 OR char_length(content_lower) > 300 THEN
    RETURN false;
  END IF;
  
  -- 2) Detectar palabras prohibidas
  FOREACH word IN ARRAY banned_words LOOP
    IF content_lower LIKE '%' || word || '%' THEN
      RETURN false;
    END IF;
  END LOOP;
  
  -- 3) Detectar CAPS excesivo (>70% del mensaje en mayúsculas)
  IF char_length(p_content) > 10 THEN
    caps_ratio := (char_length(regexp_replace(p_content, '[^A-ZÁÉÍÓÚÑ]', '', 'g'))::numeric / char_length(p_content)::numeric);
    IF caps_ratio > 0.7 THEN
      RETURN false;
    END IF;
  END IF;
  
  -- 4) Detectar URLs sospechosas (http, www, .com, .net, etc.)
  IF content_lower ~ '(http|www\.|\.com|\.net|\.org|\.es|\.io)' THEN
    RETURN false;
  END IF;
  
  -- 5) Heurística segura de spam visual: 6+ repeticiones del mismo caracter (ej. "!!!!!!" o "😂😂😂😂😂😂")
  -- Nota: Evitamos rangos Unicode problemáticos en PG regex.
  IF p_content ~ '(.)\1{5,}' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END $$;

-- ============================================================================
-- 3) RPCs SEGUROS
-- ============================================================================

-- 3.1) Crear anuncio (solo organizador, con límite por plan)
CREATE OR REPLACE FUNCTION public.post_announcement(
  p_event_id uuid,
  p_content text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
  event_venue uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;
  
  -- Validar que el contenido pase el filtro (aunque sea más permisivo para anuncios)
  IF char_length(trim(p_content)) = 0 OR char_length(p_content) > 2000 THEN
    RAISE EXCEPTION 'Contenido inválido: debe tener entre 1 y 2000 caracteres';
  END IF;
  
  -- Verificar que el usuario es el organizador del evento
  SELECT e.venue_id INTO event_venue
  FROM public.events e
  JOIN public.users u ON u.venue_id = e.venue_id
  WHERE e.id = p_event_id AND u.id = uid;
  
  IF event_venue IS NULL THEN
    RAISE EXCEPTION 'Solo el organizador puede crear anuncios';
  END IF;
  
  -- Verificar límite de anuncios según plan
  IF NOT public.can_create_announcement(uid, p_event_id) THEN
    RAISE EXCEPTION 'Has alcanzado el límite de anuncios para este evento. Actualiza tu plan para más anuncios.';
  END IF;
  
  -- Crear anuncio
  INSERT INTO public.event_announcements (event_id, organizer_id, content)
  VALUES (p_event_id, uid, p_content)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END $$;

-- 3.2) Actualizar anuncio (solo organizador)
CREATE OR REPLACE FUNCTION public.update_announcement(
  p_announcement_id uuid,
  p_content text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid uuid := auth.uid();
  announcement_organizer uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;
  
  -- Validar contenido
  IF char_length(trim(p_content)) = 0 OR char_length(p_content) > 2000 THEN
    RAISE EXCEPTION 'Contenido inválido: debe tener entre 1 y 2000 caracteres';
  END IF;
  
  -- Verificar que el usuario es el creador del anuncio
  SELECT organizer_id INTO announcement_organizer
  FROM public.event_announcements
  WHERE id = p_announcement_id;
  
  IF announcement_organizer IS NULL THEN
    RAISE EXCEPTION 'Anuncio no encontrado';
  END IF;
  
  IF announcement_organizer != uid THEN
    RAISE EXCEPTION 'Solo el organizador puede editar este anuncio';
  END IF;
  
  -- Actualizar
  UPDATE public.event_announcements
  SET content = p_content,
      updated_at = now()
  WHERE id = p_announcement_id;
END $$;

-- 3.3) Eliminar anuncio (solo organizador)
CREATE OR REPLACE FUNCTION public.delete_announcement(p_announcement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid uuid := auth.uid();
  announcement_organizer uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;
  
  SELECT organizer_id INTO announcement_organizer
  FROM public.event_announcements
  WHERE id = p_announcement_id;
  
  IF announcement_organizer IS NULL THEN
    RAISE EXCEPTION 'Anuncio no encontrado';
  END IF;
  
  IF announcement_organizer != uid THEN
    RAISE EXCEPTION 'Solo el organizador puede eliminar este anuncio';
  END IF;
  
  DELETE FROM public.event_announcements
  WHERE id = p_announcement_id;
END $$;

-- 3.4) Enviar mensaje en el chat (solo asistentes apuntados, con rate limit y filtro)
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_event_id uuid,
  p_content text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;
  
  -- Validar que está apuntado al evento
  IF NOT public.is_event_attendee(uid, p_event_id) THEN
    RAISE EXCEPTION 'Debes estar apuntado al evento para escribir en el chat';
  END IF;
  
  -- Validar rate limiting
  IF NOT public.check_chat_rate_limit(uid, p_event_id) THEN
    RAISE EXCEPTION 'Has excedido el límite de mensajes. Espera un momento antes de enviar otro mensaje.';
  END IF;
  
  -- Validar contenido con filtro
  IF NOT public.filter_message_content(p_content) THEN
    RAISE EXCEPTION 'Mensaje rechazado: contenido inapropiado. Evita insultos, spam y lenguaje ofensivo.';
  END IF;
  
  -- Crear mensaje en la tabla legacy con Realtime habilitado
  INSERT INTO public.event_chats (event_id, user_id, message)
  VALUES (p_event_id, uid, p_content)
  RETURNING id INTO new_id;
  
  -- Registrar para rate limiting
  INSERT INTO public.chat_rate_limits (user_id, event_id, message_sent_at)
  VALUES (uid, p_event_id, now());
  
  RETURN new_id;
END $$;

-- 3.5) Eliminar mensaje del chat (solo organizador)
CREATE OR REPLACE FUNCTION public.delete_chat_message(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid uuid := auth.uid();
  message_event uuid;
  event_venue uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;
  
  -- Obtener evento del mensaje
  SELECT event_id INTO message_event
  FROM public.event_chats
  WHERE id = p_message_id;
  
  IF message_event IS NULL THEN
    RAISE EXCEPTION 'Mensaje no encontrado';
  END IF;
  
  -- Verificar que el usuario es el organizador del evento
  SELECT e.venue_id INTO event_venue
  FROM public.events e
  JOIN public.users u ON u.venue_id = e.venue_id
  WHERE e.id = message_event AND u.id = uid;
  
  IF event_venue IS NULL THEN
    RAISE EXCEPTION 'Solo el organizador puede eliminar mensajes';
  END IF;
  
  -- Borrado físico en event_chats (tabla simple legacy)
  DELETE FROM public.event_chats WHERE id = p_message_id;
END $$;

-- Alias más claro para la app (mantener compatibilidad)
CREATE OR REPLACE FUNCTION public.delete_event_chat_message(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.delete_chat_message(p_message_id);
END $$;

-- 3.6) Reportar mensaje (cualquier usuario)
CREATE OR REPLACE FUNCTION public.report_chat_message(
  p_message_id uuid,
  p_reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid uuid := auth.uid();
  report_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;
  
  -- Crear reporte (UNIQUE constraint evita duplicados)
  INSERT INTO public.message_reports (message_id, reporter_id, reason)
  VALUES (p_message_id, uid, p_reason)
  ON CONFLICT (message_id, reporter_id) DO NOTHING;
  
  -- Contar reportes del mensaje
  SELECT count(*) INTO report_count
  FROM public.message_reports
  WHERE message_id = p_message_id;
  
  -- Si hay 3 o más reportes, ocultar automáticamente
  IF report_count >= 3 THEN
    UPDATE public.event_chat_messages
    SET is_deleted = true,
        deleted_at = now()
    WHERE id = p_message_id;
  END IF;
END $$;

-- ============================================================================
-- 4) RLS POLICIES
-- ============================================================================

-- 4.1) Anuncios: todos pueden leer, solo organizador crea/edita/elimina
ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anuncios: lectura pública" ON public.event_announcements;
CREATE POLICY "Anuncios: lectura pública"
ON public.event_announcements FOR SELECT
TO authenticated
USING (true);  -- Todos pueden leer anuncios

DROP POLICY IF EXISTS "Anuncios: solo organizador crea" ON public.event_announcements;
CREATE POLICY "Anuncios: solo organizador crea"
ON public.event_announcements FOR INSERT
TO authenticated
WITH CHECK (
  organizer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.users u ON u.venue_id = e.venue_id
    WHERE e.id = event_id AND u.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anuncios: solo organizador actualiza" ON public.event_announcements;
CREATE POLICY "Anuncios: solo organizador actualiza"
ON public.event_announcements FOR UPDATE
TO authenticated
USING (organizer_id = auth.uid())
WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Anuncios: solo organizador elimina" ON public.event_announcements;
CREATE POLICY "Anuncios: solo organizador elimina"
ON public.event_announcements FOR DELETE
TO authenticated
USING (organizer_id = auth.uid());

-- 4.2) Mensajes del chat: todos pueden leer (no eliminados), solo asistentes confirmados escriben
ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mensajes: lectura pública" ON public.event_chat_messages;
CREATE POLICY "Mensajes: lectura pública"
ON public.event_chat_messages FOR SELECT
TO authenticated
USING (is_deleted = false);  -- Todos pueden leer mensajes no eliminados

DROP POLICY IF EXISTS "Mensajes: solo asistentes apuntados escriben" ON public.event_chat_messages;
CREATE POLICY "Mensajes: solo asistentes apuntados escriben"
ON public.event_chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.event_attendees
    WHERE user_id = auth.uid()
      AND event_id = event_chat_messages.event_id
      AND status != 'cancelled'
  )
);

DROP POLICY IF EXISTS "Mensajes: solo organizador actualiza (para eliminar)" ON public.event_chat_messages;
CREATE POLICY "Mensajes: solo organizador actualiza (para eliminar)"
ON public.event_chat_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.users u ON u.venue_id = e.venue_id
    WHERE e.id = event_id AND u.id = auth.uid()
  )
);

-- 4.3) Reportes: usuarios autenticados pueden crear, solo organizador lee
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reportes: usuarios autenticados crean" ON public.message_reports;
CREATE POLICY "Reportes: usuarios autenticados crean"
ON public.message_reports FOR INSERT
TO authenticated
WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Reportes: solo organizador lee" ON public.message_reports;
CREATE POLICY "Reportes: solo organizador lee"
ON public.message_reports FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_chat_messages m
    JOIN public.events e ON e.id = m.event_id
    JOIN public.users u ON u.venue_id = e.venue_id
    WHERE m.id = message_id AND u.id = auth.uid()
  )
);

-- 4.4) Rate limits: solo el propio usuario puede ver sus límites
ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rate limits: solo propio usuario" ON public.chat_rate_limits;
CREATE POLICY "Rate limits: solo propio usuario"
ON public.chat_rate_limits FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 5) TRIGGERS Y FUNCIONES ADICIONALES
-- ============================================================================

-- 5.1) Trigger: actualizar updated_at en anuncios
CREATE OR REPLACE FUNCTION public.update_announcement_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_update_announcement_timestamp ON public.event_announcements;
CREATE TRIGGER trg_update_announcement_timestamp
BEFORE UPDATE ON public.event_announcements
FOR EACH ROW EXECUTE FUNCTION public.update_announcement_timestamp();

-- 5.2) Función para obtener info completa del chat (anuncios + mensajes) - útil para la app
CREATE OR REPLACE FUNCTION public.get_event_chat_summary(p_event_id uuid)
RETURNS json LANGUAGE plpgsql STABLE AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'announcements', (
      SELECT json_agg(
        json_build_object(
          'id', a.id,
          'content', a.content,
          'created_at', a.created_at,
          'updated_at', a.updated_at,
          'organizer', json_build_object(
            'id', u.id,
            'full_name', u.full_name,
            'avatar_url', u.avatar_url
          )
        ) ORDER BY a.created_at DESC
      )
      FROM public.event_announcements a
      JOIN public.users u ON u.id = a.organizer_id
      WHERE a.event_id = p_event_id
    ),
    'messages', (
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'content', c.message,
          'created_at', c.created_at,
          'user', json_build_object(
            'id', u.id,
            'full_name', u.full_name,
            'avatar_url', u.avatar_url
          )
        ) ORDER BY c.created_at DESC
      )
      FROM public.event_chats c
      JOIN public.users u ON u.id = c.user_id
      WHERE c.event_id = p_event_id
    ),
    'can_write', public.is_event_attendee(auth.uid(), p_event_id),
    'is_organizer', (
      SELECT EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.users u ON u.venue_id = e.venue_id
        WHERE e.id = p_event_id AND u.id = auth.uid()
      )
    )
  ) INTO result;
  
  RETURN result;
END $$;

-- ============================================================================
-- 6) ÍNDICES ADICIONALES PARA RENDIMIENTO
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_event_announcements_updated ON public.event_announcements(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_chat_messages_created ON public.event_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_chat_messages_deleted ON public.event_chat_messages(is_deleted) WHERE is_deleted = false;

-- ============================================================================
-- 7) COMENTARIOS EN TABLAS Y COLUMNAS (DOCUMENTACIÓN)
-- ============================================================================

COMMENT ON TABLE public.event_announcements IS 'Anuncios del organizador del evento. Fijados arriba, límites por plan: free=2, pro=6, premium=ilimitado.';
COMMENT ON TABLE public.event_chat_messages IS 'Mensajes del chat del evento. Solo asistentes apuntados (no cancelados) pueden escribir. Rate limit: 3 msg/min, 20 msg/hora.';
COMMENT ON TABLE public.message_reports IS 'Reportes de mensajes inapropiados. 3+ reportes auto-ocultan el mensaje.';
COMMENT ON TABLE public.chat_rate_limits IS 'Registro de timestamps de mensajes enviados por usuario para rate limiting.';

COMMENT ON FUNCTION public.filter_message_content IS 'Filtro de contenido: rechaza insultos, spam, CAPS excesivo, URLs y emojis repetidos.';
COMMENT ON FUNCTION public.check_chat_rate_limit IS 'Valida rate limiting: máx 3 mensajes/minuto, 20 mensajes/hora por usuario.';
COMMENT ON FUNCTION public.can_create_announcement IS 'Valida si el organizador puede crear más anuncios según su plan (free=2, pro=6, premium=ilimitado).';

-- ============================================================================
-- ✅ FIN DEL SCRIPT
-- ============================================================================

-- Para aplicar:
-- 1. Copia este script completo
-- 2. Ve a Supabase Dashboard → SQL Editor
-- 3. Pega y ejecuta
-- 4. Verifica en Logs que no hay errores
-- 5. ¡Listo! El sistema de mensajería está configurado
