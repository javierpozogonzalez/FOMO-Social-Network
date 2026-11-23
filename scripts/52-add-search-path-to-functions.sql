-- 52-add-search-path-to-functions.sql
-- Añadir SET search_path a todas las funciones SECURITY DEFINER

BEGIN;

-- Ejemplo para post_announcement (hazlo igual en todas tus funciones SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.post_announcement(
  p_event_id uuid,
  p_content text
) RETURNS uuid 
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
  event_venue uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;
  -- ...existing code...
END $$;

-- Repite para todas tus funciones críticas
-- Puedes buscar y reemplazar en todos los scripts: 
-- LANGUAGE plpgsql SECURITY DEFINER
-- por
-- LANGUAGE plpgsql SECURITY DEFINER
-- SET search_path = public, pg_temp

COMMIT;
