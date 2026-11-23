-- Script para agregar birth_date a los usuarios existentes
-- Esto permitirá que get_event_average_age funcione correctamente

-- Primero, verificar si los usuarios tienen birth_date
SELECT id, email, full_name, birth_date, city 
FROM users 
LIMIT 5;

-- Actualizar el usuario principal con birth_date (21 años = nacido en 2004)
UPDATE users 
SET birth_date = '2004-01-15'
WHERE birth_date IS NULL;

-- Verificar la actualización
SELECT id, email, full_name, birth_date, 
       EXTRACT(YEAR FROM AGE(birth_date)) as age
FROM users 
LIMIT 5;

-- Ahora verificar que los eventos tengan edad promedio
SELECT 
  e.title,
  e.city,
  COUNT(ea.id) as num_attendees,
  get_event_average_age(e.id) as average_age
FROM events e
LEFT JOIN event_attendees ea ON e.id = ea.event_id
GROUP BY e.id, e.title, e.city
ORDER BY e.city, e.title
LIMIT 10;
