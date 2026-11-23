-- Agregar ciudad a los eventos
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Madrid';

-- Agregar fecha de nacimiento a usuarios para calcular edad
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Crear índice para mejorar performance de búsqueda por ciudad
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);

-- Función para calcular edad media de asistentes de un evento
CREATE OR REPLACE FUNCTION get_event_average_age(event_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  avg_age INTEGER;
BEGIN
  SELECT ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.birth_date))))::INTEGER
  INTO avg_age
  FROM event_attendees ea
  JOIN users u ON u.id = ea.user_id
  WHERE ea.event_id = event_id_param
    AND ea.status = 'going'
    AND u.birth_date IS NOT NULL;
  
  RETURN COALESCE(avg_age, 0);
END;
$$ LANGUAGE plpgsql;

-- Eliminar la función anterior para recrearla con el nuevo return type
DROP FUNCTION IF EXISTS get_event_attendees_summary(uuid, integer);

-- Actualizar función get_event_attendees_summary para incluir edad media
CREATE OR REPLACE FUNCTION get_event_attendees_summary(event_id_param UUID, limit_param INT DEFAULT 3)
RETURNS TABLE(total_count BIGINT, average_age INTEGER, top_attendees JSONB) AS $$
DECLARE
  total BIGINT;
  avg_age INTEGER;
  top_list JSONB;
BEGIN
  -- Contar total de asistentes
  SELECT COUNT(*) INTO total
  FROM event_attendees
  WHERE event_id = event_id_param AND status = 'going';

  -- Calcular edad media
  SELECT get_event_average_age(event_id_param) INTO avg_age;

  -- Obtener top asistentes con avatares
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', u.id,
        'full_name', u.full_name,
        'avatar_url', u.avatar_url,
        'friend_count', (
          SELECT COUNT(*)
          FROM friendships f
          WHERE (f.user_id = u.id OR f.friend_id = u.id)
            AND f.status = 'accepted'
        )
      )
      ORDER BY (
        SELECT COUNT(*)
        FROM friendships f
        WHERE (f.user_id = u.id OR f.friend_id = u.id)
          AND f.status = 'accepted'
      ) DESC
    ),
    '[]'::jsonb
  )
  INTO top_list
  FROM (
    SELECT DISTINCT ea.user_id
    FROM event_attendees ea
    WHERE ea.event_id = event_id_param
      AND ea.status = 'going'
    LIMIT limit_param
  ) ea_limited
  JOIN users u ON u.id = ea_limited.user_id;

  RETURN QUERY SELECT total, avg_age, top_list;
END;
$$ LANGUAGE plpgsql;

-- Actualizar algunos eventos con diferentes ciudades (ejemplos)
UPDATE events SET city = 'Madrid' WHERE id IN (SELECT id FROM events LIMIT 5);
UPDATE events SET city = 'Barcelona' WHERE id IN (SELECT id FROM events OFFSET 5 LIMIT 3);
UPDATE events SET city = 'Valencia' WHERE id IN (SELECT id FROM events OFFSET 8 LIMIT 2);

-- Actualizar algunos usuarios con fechas de nacimiento (ejemplos)
UPDATE users SET birth_date = '1995-03-15' WHERE email = 'javier@test.com';
UPDATE users SET birth_date = '1998-07-22' WHERE email = 'maria@test.com';
UPDATE users SET birth_date = '1992-11-08' WHERE email = 'carlos@test.com';
