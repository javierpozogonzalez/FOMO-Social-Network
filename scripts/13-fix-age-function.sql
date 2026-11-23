-- Corregir la función para usar la columna 'age' en lugar de 'birth_date'
-- Ya que la app usa age directamente, no fecha de nacimiento

-- Eliminar función anterior
DROP FUNCTION IF EXISTS get_event_average_age(uuid);

-- Crear nueva función que usa la columna 'age'
CREATE OR REPLACE FUNCTION get_event_average_age(event_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  avg_age INTEGER;
BEGIN
  SELECT ROUND(AVG(u.age))::INTEGER
  INTO avg_age
  FROM event_attendees ea
  JOIN users u ON u.id = ea.user_id
  WHERE ea.event_id = event_id_param
    AND ea.status = 'going'
    AND u.age IS NOT NULL;
  
  RETURN COALESCE(avg_age, 0);
END;
$$ LANGUAGE plpgsql;

-- Verificar que funcione
SELECT 
  e.id,
  e.title,
  e.city,
  COUNT(ea.id) as num_attendees,
  get_event_average_age(e.id) as average_age
FROM events e
LEFT JOIN event_attendees ea ON e.id = ea.event_id
GROUP BY e.id, e.title, e.city
ORDER BY e.city, e.title
LIMIT 10;
