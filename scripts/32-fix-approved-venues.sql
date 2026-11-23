-- Arreglar usuarios que tienen aplicaciones aprobadas pero account_type incorrecto
-- Este script corrige usuarios que fueron aprobados con account_type 'venue_free' o NULL

-- 1. Primero, actualizar la función approve_venue_application (ya corregida en 25-approve-venue-application.sql)

-- 2. Corregir usuarios existentes que ya fueron aprobados
UPDATE users
SET account_type = 'venue'
WHERE id IN (
  SELECT user_id 
  FROM venue_applications 
  WHERE status = 'approved'
)
AND (account_type IS NULL OR account_type != 'venue');

-- 3. Verificar que Anton Guitian (usuario del ejemplo) esté corregido
-- ID del usuario: e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae
UPDATE users
SET account_type = 'venue',
    venue_id = 'b0a75185-d9f4-49fa-abad-9b1047323db1'
WHERE id = 'e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae';

-- 4. Verificar resultado
SELECT 
  u.id,
  u.full_name,
  u.email,
  u.account_type,
  u.venue_id,
  va.venue_name,
  va.status as application_status
FROM users u
LEFT JOIN venue_applications va ON va.user_id = u.id
WHERE va.status = 'approved'
ORDER BY u.full_name;
