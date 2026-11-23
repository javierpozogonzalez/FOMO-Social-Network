-- =============================================================
-- ADD MISSING DELETE POLICY ON users + OPTIONAL FULL ACCOUNT RPC
-- =============================================================
-- MOTIVO: Error "permission denied for table users" porque NO existe
-- una política FOR DELETE sobre la tabla public.users.
-- =============================================================

-- 1) Crear política DELETE (solo si no existe todavía)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' AND policyname='Users can delete their own profile'
  ) THEN
    RAISE NOTICE 'Creating DELETE policy on users';
    EXECUTE $$CREATE POLICY "Users can delete their own profile" ON public.users
             FOR DELETE TO authenticated USING (auth.uid() = id);$$;
  ELSE
    RAISE NOTICE 'DELETE policy on users already exists';
  END IF;
END$$;

-- 2) (Opcional) Función para eliminar COMPLETAMENTE la cuenta (public.users + auth.users)
-- IMPORTANTE: Borrar de auth.users elimina al usuario del sistema de autenticación.
-- Solo usar si realmente quieres eliminar por completo la cuenta.
-- Usa SECURITY DEFINER para ejecutar con privilegios del dueño (postgres).

CREATE OR REPLACE FUNCTION public.delete_account_completely()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No authenticated user (auth.uid() is null)';
  END IF;

  -- Borrar primero datos relacionados (si no hay ON DELETE CASCADE suficientes)
  DELETE FROM friendships WHERE user_id = v_uid OR friend_id = v_uid;
  DELETE FROM event_attendees WHERE user_id = v_uid;
  DELETE FROM events WHERE created_by = v_uid;
  DELETE FROM user_settings WHERE user_id = v_uid;
  DELETE FROM notification_tokens WHERE user_id = v_uid;
  DELETE FROM venue_followers WHERE user_id = v_uid;
  DELETE FROM external_attendance_batches WHERE created_by = v_uid;
  DELETE FROM venue_applications WHERE user_id = v_uid;

  -- Borrar perfil en public.users
  DELETE FROM users WHERE id = v_uid;

  -- Borrar usuario de auth (tabla interna). Esto invalida su sesión.
  DELETE FROM auth.users WHERE id = v_uid;
END;$$;

-- 3) Dar permiso de ejecución a role authenticated
GRANT EXECUTE ON FUNCTION public.delete_account_completely() TO authenticated;

-- 4) Verificar que la política DELETE exista ahora
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename='users';
