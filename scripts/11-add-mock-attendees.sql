-- Script para agregar asistentes mock a los eventos existentes
-- Esto permitirá que el filtro de edad funcione correctamente

-- Desactivar temporalmente el trigger de mismo día
ALTER TABLE event_attendees DISABLE TRIGGER trg_no_double_booking;

DO $$
DECLARE
  event_record RECORD;
  current_user_id UUID;
BEGIN
  -- Obtener el primer usuario existente
  SELECT id INTO current_user_id FROM users LIMIT 1;
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuarios en la base de datos.';
  END IF;

  -- Para cada evento, agregar el usuario como asistente
  FOR event_record IN SELECT id FROM events LOOP
    -- Insertar asistencia si no existe
    INSERT INTO event_attendees (event_id, user_id, status, is_visible)
    VALUES (event_record.id, current_user_id, 'going', true)
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Asistentes agregados exitosamente';
END $$;

-- Reactivar el trigger
ALTER TABLE event_attendees ENABLE TRIGGER trg_no_double_booking;

-- Verificar
SELECT 
  e.title,
  e.city,
  COUNT(ea.id) as attendees,
  get_event_average_age(e.id) as average_age
FROM events e
LEFT JOIN event_attendees ea ON e.id = ea.event_id
GROUP BY e.id, e.title, e.city
ORDER BY e.city, e.title
LIMIT 20;
