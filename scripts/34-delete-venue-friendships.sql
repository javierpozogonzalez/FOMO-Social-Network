-- Script 34: Borrar amistades de venues existentes que ya fueron aprobados

-- PASO 1: Borrar amistades de todos los usuarios que son venues
-- Esto incluye amistades donde son user_id o friend_id

DELETE FROM friendships
WHERE user_id IN (
  SELECT id FROM users WHERE account_type IN ('venue', 'venue_free', 'venue_pro', 'venue_premium')
)
OR friend_id IN (
  SELECT id FROM users WHERE account_type IN ('venue', 'venue_free', 'venue_pro', 'venue_premium')
);

-- PASO 2: Borrar específicamente las amistades de Anton Guitian
DELETE FROM friendships
WHERE user_id = 'e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae'
   OR friend_id = 'e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae';

-- PASO 3: Verificar que no quedan amistades
SELECT 
  f.id,
  f.user_id,
  u1.full_name as user_name,
  f.friend_id,
  u2.full_name as friend_name
FROM friendships f
JOIN users u1 ON f.user_id = u1.id
JOIN users u2 ON f.friend_id = u2.id
WHERE u1.account_type IN ('venue', 'venue_free', 'venue_pro', 'venue_premium')
   OR u2.account_type IN ('venue', 'venue_free', 'venue_pro', 'venue_premium');

-- Si la consulta anterior devuelve filas, hay un problema
-- Debería devolver 0 filas
