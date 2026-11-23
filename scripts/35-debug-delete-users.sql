-- =============================================================
-- DIAGNÓSTICO: ¿Por qué sigue apareciendo permission denied?
-- =============================================================
-- Ejecuta este script en el SQL Editor para instalar funciones
-- de ayuda y luego prueba con: select * from debug_can_delete_user('<USER_UUID>');
-- Sustituye <USER_UUID> por el id (auth.users.id) de la sesión.
-- =============================================================

-- 1) Función para evaluar la expresión de la política DELETE
CREATE OR REPLACE FUNCTION public.debug_can_delete_user(target uuid)
RETURNS TABLE(current_uid uuid, target_row_id uuid, policy_matches boolean, row_exists boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  current_uid := auth.uid();
  SELECT id INTO target_row_id FROM public.users WHERE id = target;
  row_exists := target_row_id IS NOT NULL;
  policy_matches := (current_uid = target_row_id);
  RETURN NEXT;
END;$$;
GRANT EXECUTE ON FUNCTION public.debug_can_delete_user(uuid) TO authenticated;

-- 2) Función para intentar DELETE y devolver mensaje
CREATE OR REPLACE FUNCTION public.try_delete_user(target uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM * FROM public.users WHERE id = target; -- force RLS visibility check
  DELETE FROM public.users WHERE id = target; -- will obey RLS
  RETURN 'DELETE ejecutado (revisa si la fila desapareció)';
EXCEPTION WHEN others THEN
  RETURN 'EXCEPTION: ' || SQLERRM;
END;$$;
GRANT EXECUTE ON FUNCTION public.try_delete_user(uuid) TO authenticated;

-- 3) Comando ejemplo (REEMPLAZA <UUID>)
-- select * from debug_can_delete_user('<UUID>');
-- select try_delete_user('<UUID>');
