-- =============================================================
-- Robust RPC: delete_account_completely(p_user_id uuid)
-- Soluciona error PGRST202 creando función con parámetro nombrado.
-- Incluye NOTIFY para recargar el schema cache de PostgREST.
-- =============================================================
-- Uso luego en cliente:
-- await supabase.rpc('delete_account_completely', { p_user_id: user.id })
-- =============================================================

CREATE OR REPLACE FUNCTION public.delete_account_completely(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := p_user_id; -- usamos el parámetro explícito
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Parametro p_user_id es NULL';
  END IF;

  -- Opcional: asegurar que el invocador es el dueño
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_uid THEN
    RAISE EXCEPTION 'No autorizado a eliminar otra cuenta';
  END IF;

  -- Borrar datos relacionados (muchos ya tienen ON DELETE CASCADE, esto es por redundancia)
  DELETE FROM friendships WHERE user_id = v_uid OR friend_id = v_uid;
  DELETE FROM event_attendees WHERE user_id = v_uid;
  DELETE FROM events WHERE created_by = v_uid;
  DELETE FROM user_settings WHERE user_id = v_uid;
  DELETE FROM notification_tokens WHERE user_id = v_uid;
  DELETE FROM venue_followers WHERE user_id = v_uid;
  -- Tabla external_attendance_batches no tiene columna created_by: borramos por relación con eventos o venue
  DELETE FROM external_attendance_batches
  WHERE event_id IN (SELECT id FROM events WHERE created_by = v_uid)
     OR venue_id IN (SELECT id FROM venue_applications WHERE user_id = v_uid);
  DELETE FROM venue_applications WHERE user_id = v_uid;

  -- Borrar perfil
  DELETE FROM users WHERE id = v_uid;

  -- Borrar usuario de auth
  DELETE FROM auth.users WHERE id = v_uid;
END;$$;

GRANT EXECUTE ON FUNCTION public.delete_account_completely(uuid) TO authenticated;

-- Forzar recarga de schema en PostgREST (Supabase)
NOTIFY pgrst, 'reload schema';

-- Verificar existencia en catálogo
SELECT proname, prosecdef, proargtypes::regtype[] AS argtypes
FROM pg_proc JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
WHERE n.nspname='public' AND proname='delete_account_completely';
