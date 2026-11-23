-- Migración de venue_followers para usar venue_id en lugar de venue_name
-- Este script:
-- 1. Crea una nueva columna venue_id
-- 2. Migra los datos existentes
-- 3. Elimina las columnas antiguas (venue_name, city)
-- 4. Actualiza índices, constraints y funciones
-- Ejecutar en SQL Editor de Supabase

-- ===== PASO 1: AGREGAR COLUMNA venue_id =====

-- Agregar la columna venue_id (nullable temporalmente para migración)
ALTER TABLE public.venue_followers 
ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venue_applications(id) ON DELETE CASCADE;

-- ===== PASO 2: MIGRAR DATOS EXISTENTES =====

-- Actualizar venue_id basándose en venue_name para los registros existentes
UPDATE public.venue_followers vf
SET venue_id = va.id
FROM public.venue_applications va
WHERE vf.venue_name = va.venue_name 
  AND vf.city = va.city
  AND vf.venue_id IS NULL;

-- Eliminar registros que no tengan match (venues que ya no existen)
DELETE FROM public.venue_followers WHERE venue_id IS NULL;

-- ===== PASO 3: RECONFIGURAR TABLA =====

-- Eliminar el constraint de primary key anterior
ALTER TABLE public.venue_followers DROP CONSTRAINT IF EXISTS venue_followers_pkey;

-- Eliminar índices antiguos
DROP INDEX IF EXISTS idx_venue_followers_venue;

-- Eliminar columnas antiguas
ALTER TABLE public.venue_followers DROP COLUMN IF EXISTS venue_name CASCADE;
ALTER TABLE public.venue_followers DROP COLUMN IF EXISTS city CASCADE;

-- Hacer venue_id NOT NULL
ALTER TABLE public.venue_followers ALTER COLUMN venue_id SET NOT NULL;

-- Crear nueva primary key
ALTER TABLE public.venue_followers 
ADD CONSTRAINT venue_followers_pkey PRIMARY KEY (user_id, venue_id);

-- ===== PASO 4: CREAR ÍNDICES OPTIMIZADOS =====

CREATE INDEX IF NOT EXISTS idx_venue_followers_venue_id ON public.venue_followers(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_followers_user_id ON public.venue_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_followers_favorite ON public.venue_followers(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_venue_followers_venue_notif ON public.venue_followers(venue_id, notifications_enabled) WHERE notifications_enabled = true;

-- ===== PASO 5: ACTUALIZAR FUNCIONES =====

-- Eliminar funciones antiguas antes de recrearlas
DROP FUNCTION IF EXISTS public.get_venue_follower_count(text, text);
DROP FUNCTION IF EXISTS public.get_user_venue_stats(uuid);

-- Función para obtener el conteo de followers de un venue (por ID)
CREATE OR REPLACE FUNCTION public.get_venue_follower_count(p_venue_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM venue_followers
  WHERE venue_id = p_venue_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_venue_follower_count(uuid) TO anon, authenticated;

-- Función para obtener estadísticas de venues de un usuario (actualizada)
CREATE FUNCTION public.get_user_venue_stats(p_user_id uuid)
RETURNS TABLE (
  venue_id uuid,
  venue_name text,
  venue_logo text,
  city text,
  category text,
  events_attended int,
  is_following boolean,
  is_favorite boolean,
  next_event_id uuid,
  next_event_name text,
  next_event_date timestamptz,
  friends_following_count int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_venues AS (
    -- Venues donde el usuario ha asistido a eventos
    SELECT 
      e.venue_id,
      count(DISTINCT ea.event_id)::int as events_attended,
      max(e.event_date) as last_attended
    FROM events e
    INNER JOIN event_attendees ea ON ea.event_id = e.id
    WHERE ea.user_id = p_user_id 
      AND ea.status = 'going'
      AND e.event_date <= now()
      AND e.venue_id IS NOT NULL
    GROUP BY e.venue_id
  ),
  user_follows AS (
    -- Venues que el usuario sigue
    SELECT venue_id, is_favorite, followed_at
    FROM venue_followers
    WHERE user_id = p_user_id
  ),
  next_events AS (
    -- Próximo evento de cada venue
    SELECT DISTINCT ON (e.venue_id)
      e.venue_id,
      e.id as event_id,
      e.title as event_name,
      e.event_date
    FROM events e
    WHERE e.event_date >= now()
      AND e.venue_id IS NOT NULL
    ORDER BY e.venue_id, e.event_date ASC
  ),
  friends_counts AS (
    -- Cuántos amigos siguen cada venue
    SELECT 
      vf.venue_id as fc_venue_id,
      count(DISTINCT vf.user_id)::int as friends_count
    FROM venue_followers vf
    WHERE vf.user_id IN (
      -- Amigos del usuario (bidireccionales)
      SELECT f1.friend_id 
      FROM friendships f1
      WHERE f1.user_id = p_user_id 
        AND f1.status = 'accepted'
        AND EXISTS (
          SELECT 1 FROM friendships f2 
          WHERE f2.user_id = f1.friend_id 
            AND f2.friend_id = p_user_id 
            AND f2.status = 'accepted'
        )
    )
    GROUP BY vf.venue_id
  ),
  categorized AS (
    SELECT 
      uv.venue_id,
      va.venue_name,
      va.venue_logo,
      va.city,
      CASE 
        WHEN uf.is_favorite = true THEN 'favorite'
        WHEN uv.events_attended >= 3 THEN 'frequent'
        WHEN uv.last_attended >= now() - interval '30 days' THEN 'recent'
        ELSE 'other'
      END as category,
      uv.events_attended,
      (uf.venue_id IS NOT NULL) as is_following,
      coalesce(uf.is_favorite, false) as is_favorite,
      ne.event_id as next_event_id,
      ne.event_name as next_event_name,
      ne.event_date as next_event_date,
      coalesce(fc.friends_count, 0) as friends_following_count
    FROM user_venues uv
    INNER JOIN venue_applications va ON va.id = uv.venue_id
    LEFT JOIN user_follows uf ON uf.venue_id = uv.venue_id
    LEFT JOIN next_events ne ON ne.venue_id = uv.venue_id
    LEFT JOIN friends_counts fc ON fc.fc_venue_id = uv.venue_id
  )
  SELECT * FROM categorized
  WHERE category IN ('frequent', 'favorite', 'recent')
  ORDER BY 
    CASE category
      WHEN 'favorite' THEN 1
      WHEN 'frequent' THEN 2
      WHEN 'recent' THEN 3
    END,
    events_attended DESC,
    venue_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_venue_stats(uuid) TO anon, authenticated;

-- ===== PASO 6: COMENTARIOS =====

COMMENT ON TABLE public.venue_followers IS 'Seguimiento de venues por usuarios (usando venue_id como foreign key)';
COMMENT ON COLUMN public.venue_followers.venue_id IS 'ID del venue (FK a venue_applications.id)';
COMMENT ON FUNCTION public.get_venue_follower_count IS 'Obtiene el número de seguidores de un venue por su ID';
COMMENT ON FUNCTION public.get_user_venue_stats IS 'Estadísticas de venues para un usuario (frecuentes, favoritos, recientes)';
