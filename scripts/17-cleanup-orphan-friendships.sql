-- Script para limpiar amistades huérfanas y arreglar conteos
-- Ejecutar este script una vez para limpiar datos existentes

-- 1) Ver las filas huérfanas de amistad (donde solo existe una dirección pero no la inversa)
SELECT 
  f1.id, 
  f1.user_id, 
  f1.friend_id,
  u1.full_name as user_name,
  u2.full_name as friend_name
FROM friendships f1
JOIN users u1 ON u1.id = f1.user_id
JOIN users u2 ON u2.id = f1.friend_id
WHERE f1.status = 'accepted'
AND NOT EXISTS (
  SELECT 1 
  FROM friendships f2 
  WHERE f2.user_id = f1.friend_id 
  AND f2.friend_id = f1.user_id 
  AND f2.status = 'accepted'
);

-- 2) ELIMINAR todas las filas huérfanas (amistades unidireccionales)
-- Esto rompe completamente las amistades que no son bidireccionales
DELETE FROM friendships 
WHERE id IN (
  SELECT f1.id
  FROM friendships f1
  WHERE f1.status = 'accepted'
  AND NOT EXISTS (
    SELECT 1 
    FROM friendships f2 
    WHERE f2.user_id = f1.friend_id 
    AND f2.friend_id = f1.user_id 
    AND f2.status = 'accepted'
  )
);

-- 3) Verificar que ahora todos los conteos sean correctos
-- Esta query debería mostrar conteos simétricos (mismo número en outgoing e incoming)
SELECT 
  u.full_name,
  u.id,
  (SELECT count(*) FROM friendships WHERE user_id = u.id AND status = 'accepted') as outgoing,
  (SELECT count(*) FROM friendships WHERE friend_id = u.id AND status = 'accepted') as incoming
FROM users u
WHERE u.id IN (
  SELECT DISTINCT user_id FROM friendships 
  UNION 
  SELECT DISTINCT friend_id FROM friendships
)
ORDER BY u.full_name;
