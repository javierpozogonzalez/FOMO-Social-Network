-- Script 37: Reglas de integridad para eventos
-- Objetivo:
-- 1) Evitar más de un evento por día por local (venue)
-- 2) Evitar publicar eventos en fechas pasadas
--
-- NOTAS IMPORTANTES:
-- - Ejecuta esto en el SQL editor de Supabase con tu base de datos.
-- - La restricción de fecha pasada se evalúa sólo en INSERT/UPDATE.
-- - El índice único se crea sólo para filas con venue_id no nulo.

-- 1) Evitar más de un evento por día por local
--    Usamos un índice único parcial para permitir múltiples NULL en venue_id
--    pero restringir duplicados cuando venue_id esté presente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'uq_events_venue_per_day'
      AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX uq_events_venue_per_day
    ON public.events(venue_id, event_date)
    WHERE venue_id IS NOT NULL;
  END IF;
END $$;

-- 2) Evitar publicar eventos en fechas pasadas
--    CHECK con CURRENT_DATE (estable por transacción)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_future_date'
  ) THEN
    -- NOT VALID para no romper filas históricas; aplica a nuevos INSERT/UPDATE
    ALTER TABLE public.events
    ADD CONSTRAINT events_future_date
    CHECK (event_date >= CURRENT_DATE) NOT VALID;
  END IF;
END $$;
