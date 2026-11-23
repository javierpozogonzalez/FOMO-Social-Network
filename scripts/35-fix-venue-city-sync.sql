-- =====================================================
-- Script 35: Sincronizar ciudad de venues
-- =====================================================
-- Problema: Los usuarios que son venues tienen city en tabla users diferente a venue_applications
-- Solución: Actualizar users.city para que coincida con venue_applications.city

-- Paso 1: Actualizar la ciudad de todos los usuarios venue para que coincida con venue_applications
UPDATE users
SET city = va.city
FROM venue_applications va
WHERE users.venue_id = va.id
  AND users.account_type = 'venue'
  AND users.city != va.city;

-- Verificar el resultado
SELECT 
  u.id as user_id,
  u.full_name,
  u.city as user_city,
  va.venue_name,
  va.city as venue_city,
  CASE 
    WHEN u.city = va.city THEN '✅ Sincronizado'
    ELSE '❌ Desincronizado'
  END as status
FROM users u
JOIN venue_applications va ON u.venue_id = va.id
WHERE u.account_type = 'venue';

-- Mostrar específicamente Anton Guitian
SELECT 
  u.id,
  u.full_name,
  u.city as ciudad_en_users,
  va.venue_name,
  va.city as ciudad_en_venue_applications,
  va.business_address
FROM users u
JOIN venue_applications va ON u.venue_id = va.id
WHERE u.id = 'e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae';
