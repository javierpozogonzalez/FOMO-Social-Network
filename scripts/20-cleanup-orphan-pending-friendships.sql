-- Script de limpieza para eliminar solicitudes de amistad huérfanas
-- Problema: Si dos usuarios fueron amigos y luego se eliminaron, pueden quedar solicitudes 'pending' antiguas
-- Este script limpia esos casos y asegura consistencia en la tabla friendships

-- 1. Eliminar solicitudes 'pending' duplicadas donde ya existe una amistad 'accepted'
DELETE FROM friendships f1
WHERE f1.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM friendships f2
    WHERE (
      (f2.user_id = f1.user_id AND f2.friend_id = f1.friend_id)
      OR (f2.user_id = f1.friend_id AND f2.friend_id = f1.user_id)
    )
    AND f2.status = 'accepted'
    AND f2.id != f1.id
  );

-- 2. Eliminar solicitudes 'pending' huérfanas muy antiguas (más de 90 días)
-- Opcional: comenta esto si quieres mantener solicitudes antiguas
-- DELETE FROM friendships
-- WHERE status = 'pending'
--   AND created_at < NOW() - INTERVAL '90 days';

-- 3. Mostrar resumen de estado actual
SELECT 
  status,
  COUNT(*) as total_records
FROM friendships
GROUP BY status
ORDER BY status;

-- 4. Identificar usuarios con relaciones inconsistentes
-- (tienen amistad en una dirección pero no en la otra)
SELECT 
  f1.user_id,
  f1.friend_id,
  f1.status as direction_1_status,
  f2.status as direction_2_status
FROM friendships f1
LEFT JOIN friendships f2 
  ON f1.user_id = f2.friend_id 
  AND f1.friend_id = f2.user_id
WHERE f1.status = 'accepted'
  AND (f2.id IS NULL OR f2.status != 'accepted');

-- NOTA: Si la query anterior devuelve resultados, hay amistades inconsistentes
-- Puedes arreglarlas ejecutando manualmente inserts o usando la función delete_friendship_bidirectional
