-- Script para crear amistad entre Javier Pozo Gonzalez y Marina Hernandez
-- Fecha: 24 de octubre de 2025

-- Primero obtenemos los IDs de ambos usuarios
DO $$
DECLARE
  javier_id UUID;
  marina_id UUID;
BEGIN
  -- Buscar ID de Javier Pozo Gonzalez
  SELECT id INTO javier_id
  FROM public.users
  WHERE full_name = 'Javier Pozo Gonzalez'
  LIMIT 1;

  -- Buscar ID de Marina Hernandez
  SELECT id INTO marina_id
  FROM public.users
  WHERE full_name = 'Marina Hernandez'
  LIMIT 1;

  -- Verificar que ambos usuarios existen
  IF javier_id IS NULL THEN
    RAISE EXCEPTION 'Usuario Javier Pozo Gonzalez no encontrado';
  END IF;

  IF marina_id IS NULL THEN
    RAISE EXCEPTION 'Usuario Marina Hernandez no encontrado';
  END IF;

  -- Crear amistad bidireccional (ambos usuarios son amigos mutuamente)
  
  -- Javier -> Marina
  INSERT INTO public.friendships (user_id, friend_id, status, created_at)
  VALUES (javier_id, marina_id, 'accepted', NOW())
  ON CONFLICT (user_id, friend_id) 
  DO UPDATE SET status = 'accepted', created_at = NOW();

  -- Marina -> Javier
  INSERT INTO public.friendships (user_id, friend_id, status, created_at)
  VALUES (marina_id, javier_id, 'accepted', NOW())
  ON CONFLICT (user_id, friend_id) 
  DO UPDATE SET status = 'accepted', created_at = NOW();

  RAISE NOTICE 'Amistad creada exitosamente entre Javier Pozo Gonzalez (%) y Marina Hernandez (%)', javier_id, marina_id;
END $$;

-- Verificar que la amistad se creó correctamente
SELECT 
  u1.full_name as usuario,
  u2.full_name as amigo,
  f.status,
  f.created_at
FROM public.friendships f
JOIN public.users u1 ON f.user_id = u1.id
JOIN public.users u2 ON f.friend_id = u2.id
WHERE (u1.full_name = 'Javier Pozo Gonzalez' AND u2.full_name = 'Marina Hernandez')
   OR (u1.full_name = 'Marina Hernandez' AND u2.full_name = 'Javier Pozo Gonzalez')
ORDER BY f.created_at DESC;
