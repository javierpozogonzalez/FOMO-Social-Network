-- Script: fix-friendship-rls.sql
-- Soluciona el bug de RLS al aceptar solicitudes de amistad
-- Crea una función SECURITY DEFINER para aceptar solicitudes y crear relación bidireccional

-- Habilitar RLS si no está activo
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Permitir ver amistades propias
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

-- Permitir crear amistad solo si el usuario autenticado es el que envía la solicitud
DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
CREATE POLICY "Users can create friendships" ON friendships
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Permitir actualizar amistad si el usuario autenticado es el que envía o recibe
DROP POLICY IF EXISTS "Users can update own friendships" ON friendships;
CREATE POLICY "Users can update own friendships" ON friendships
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR friend_id = auth.uid());

-- Permitir eliminar amistad si el usuario autenticado es el que envía o recibe
DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;
CREATE POLICY "Users can delete own friendships" ON friendships
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

-- Función SECURITY DEFINER para aceptar solicitudes de amistad (relación bidireccional)
CREATE OR REPLACE FUNCTION public.accept_friendship_request(request_id uuid, sender_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Verificar que el usuario actual es el destinatario de la solicitud
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE id = request_id
      AND friend_id = current_user_id
      AND user_id = sender_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para aceptar esta solicitud';
  END IF;
  
  -- Eliminar cualquier relación previa entre estos usuarios
  DELETE FROM public.friendships
  WHERE (user_id = current_user_id AND friend_id = sender_id)
     OR (user_id = sender_id AND friend_id = current_user_id);
  
  -- Crear ambas direcciones de amistad aceptada
  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES 
    (current_user_id, sender_id, 'accepted'),
    (sender_id, current_user_id, 'accepted');
END;
$$;

-- Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.accept_friendship_request(uuid, uuid) TO authenticated;

-- Confirmar cambios
COMMIT;
