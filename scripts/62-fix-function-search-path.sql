-- 62-fix-function-search-path.sql
-- Objetivo: Eliminar el warning "Function Search Path Mutable" del Security Advisor
-- Estrategia: Establecer search_path fijo (pg_catalog, public) en TODAS las funciones del esquema public
-- Notas:
--   - No toca la lógica de ninguna función; solo añade un parámetro seguro a nivel de función.
--   - Usa pg_proc para detectar funciones que aún no tienen search_path configurado.
--   - Seguro para re-ejecutar; solo altera funciones sin search_path en proconfig.

DO $$
DECLARE
  r RECORD;
  changed_count int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS funcsig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg ILIKE 'search_path=%'
        )
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public;', r.funcsig);
    changed_count := changed_count + 1;
    RAISE NOTICE 'search_path fijado en: %', r.funcsig;
  END LOOP;

  RAISE NOTICE 'Funciones actualizadas: %', changed_count;
  IF changed_count = 0 THEN
    RAISE NOTICE 'Todas las funciones en public ya tenían search_path fijo.';
  END IF;
END $$;

-- Verificación rápida: lista de funciones en public que aún no tienen search_path
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (
      p.proconfig IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg ILIKE 'search_path=%'
      )
    );

  IF remaining = 0 THEN
    RAISE NOTICE '✅ Todas las funciones en public tienen search_path fijado.';
  ELSE
    RAISE NOTICE '⚠️ Aún quedan % funciones sin search_path. Revisa funciones creadas por extensiones o fuera de public.', remaining;
  END IF;
END $$;
