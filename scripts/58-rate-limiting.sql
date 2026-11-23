-- Script 58: Rate Limiting System (Anti-spam/DDoS)
-- Previene abuso de funciones RPC críticas
-- Impacto: NINGUNO para usuarios normales - Solo bloquea spam
-- Beneficio: Previene ataques DDoS y spam de solicitudes

-- PASO 1: Crear tabla para tracking de rate limits
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- Nombre de la acción (friend_request, event_create, etc.)
  count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_action ON rate_limit_tracking(user_id, action);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_tracking(window_end);
CREATE INDEX IF NOT EXISTS idx_rate_limit_created ON rate_limit_tracking(created_at);

-- PASO 2: Función genérica de rate limiting
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_action text,
  p_max_requests int,
  p_window_minutes int DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_count int;
  v_window_start timestamptz;
  v_window_end timestamptz;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  
  -- Calcular ventana de tiempo
  v_window_start := NOW();
  v_window_end := v_window_start + (p_window_minutes || ' minutes')::interval;
  
  -- Buscar registro activo en la ventana
  SELECT count INTO v_current_count
  FROM rate_limit_tracking
  WHERE user_id = v_user_id
    AND action = p_action
    AND window_end > NOW()
  ORDER BY window_end DESC
  LIMIT 1;
  
  -- Si existe y está dentro del límite
  IF v_current_count IS NOT NULL THEN
    IF v_current_count >= p_max_requests THEN
      RAISE EXCEPTION 'Rate limit excedido para %. Máximo % por % minutos', 
        p_action, p_max_requests, p_window_minutes;
    END IF;
    
    -- Incrementar contador
    UPDATE rate_limit_tracking
    SET count = count + 1
    WHERE user_id = v_user_id
      AND action = p_action
      AND window_end > NOW();
  ELSE
    -- Crear nuevo registro
    INSERT INTO rate_limit_tracking (user_id, action, count, window_start, window_end)
    VALUES (v_user_id, p_action, 1, v_window_start, v_window_end);
  END IF;
  
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit(text, int, int) TO authenticated;

-- PASO 3: Función de limpieza automática (llamar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limit_tracking
  WHERE created_at < NOW() - INTERVAL '1 hour';
$$;

-- PASO 4: Aplicar rate limiting a funciones críticas existentes

-- 4.1: Rate limit para solicitudes de amistad (max 10 por minuto)
CREATE OR REPLACE FUNCTION send_friend_request_with_limit(p_friend_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar rate limit (10 solicitudes por minuto)
  PERFORM check_rate_limit('friend_request', 10, 1);
  
  -- Insertar solicitud
  INSERT INTO friendships (user_id, friend_id, status)
  VALUES (auth.uid(), p_friend_id, 'pending')
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION send_friend_request_with_limit(uuid) TO authenticated;

-- 4.2: Rate limit para crear eventos (max 5 por hora)
CREATE OR REPLACE FUNCTION create_event_with_limit(
  p_title text,
  p_description text,
  p_venue_name text,
  p_city text,
  p_event_date date,
  p_start_time time,
  p_end_time time
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_venue_id uuid;
BEGIN
  -- Verificar rate limit (5 eventos por hora)
  PERFORM check_rate_limit('event_create', 5, 60);
  
  -- Obtener venue_id del usuario
  SELECT venue_id INTO v_venue_id
  FROM users
  WHERE id = auth.uid();
  
  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no es un venue';
  END IF;
  
  -- Crear evento
  INSERT INTO events (
    title, description, venue_name, city, event_date, 
    start_time, end_time, created_by, venue_id
  )
  VALUES (
    p_title, p_description, p_venue_name, p_city, p_event_date,
    p_start_time, p_end_time, auth.uid(), v_venue_id
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_event_with_limit(text, text, text, text, date, time, time) TO authenticated;

-- 4.3: Rate limit para reportes (max 5 por día) - Ya implementado en script 57

-- 4.4: Rate limit para mensajes de chat (max 30 por minuto)
CREATE OR REPLACE FUNCTION send_chat_message_with_limit(
  p_event_id uuid,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id uuid;
BEGIN
  -- Verificar rate limit (30 mensajes por minuto)
  PERFORM check_rate_limit('chat_message', 30, 1);
  
  -- Verificar que el usuario está apuntado al evento
  IF NOT EXISTS (
    SELECT 1 FROM event_attendees
    WHERE event_id = p_event_id
      AND user_id = auth.uid()
      AND status = 'going'
  ) THEN
    RAISE EXCEPTION 'Debes estar apuntado al evento para enviar mensajes';
  END IF;
  
  -- Insertar mensaje
  INSERT INTO event_chats (event_id, user_id, message)
  VALUES (p_event_id, auth.uid(), p_message)
  RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION send_chat_message_with_limit(uuid, text) TO authenticated;

-- 4.5: Rate limit para búsqueda de usuarios (max 20 por minuto)
CREATE OR REPLACE FUNCTION search_users_with_limit(p_query text)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  city text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar rate limit (20 búsquedas por minuto)
  PERFORM check_rate_limit('user_search', 20, 1);
  
  RETURN QUERY
  SELECT u.id, u.full_name, u.avatar_url, u.city
  FROM users u
  WHERE u.full_name ILIKE '%' || p_query || '%'
    AND u.id != auth.uid()
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION search_users_with_limit(text) TO authenticated;

-- PASO 5: Enable RLS en rate_limit_tracking
ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Solo el sistema puede escribir (las funciones usan SECURITY DEFINER)
DROP POLICY IF EXISTS "System only" ON rate_limit_tracking;
CREATE POLICY "System only" ON rate_limit_tracking
  FOR ALL 
  USING (false);

-- PASO 6: Job de limpieza automática (ejecutar cada hora)
-- Nota: Esto requiere pg_cron extension o ejecutarlo manualmente
-- Para hacerlo manual, ejecuta periódicamente:
-- SELECT cleanup_old_rate_limits();

COMMENT ON TABLE rate_limit_tracking IS 'Tracking de rate limits para prevenir spam/DDoS';
COMMENT ON FUNCTION check_rate_limit IS 'Verifica y actualiza contadores de rate limit';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Limpia registros antiguos (ejecutar cada hora)';

-- VERIFICACIÓN
DO $$
BEGIN
  RAISE NOTICE '✅ Script 58 ejecutado correctamente';
  RAISE NOTICE '🚦 Rate limiting implementado:';
  RAISE NOTICE '   - Solicitudes de amistad: 10/min';
  RAISE NOTICE '   - Crear eventos: 5/hora';
  RAISE NOTICE '   - Mensajes de chat: 30/min';
  RAISE NOTICE '   - Búsqueda de usuarios: 20/min';
  RAISE NOTICE '   - Reportes: 5/día (script 57)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ IMPORTANTE: Ejecutar cleanup_old_rate_limits() cada hora';
  RAISE NOTICE '   O configurar pg_cron para auto-limpieza';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Las funciones nuevas con rate limit:';
  RAISE NOTICE '   - send_friend_request_with_limit(uuid)';
  RAISE NOTICE '   - create_event_with_limit(...)';
  RAISE NOTICE '   - send_chat_message_with_limit(uuid, text)';
  RAISE NOTICE '   - search_users_with_limit(text)';
END $$;
