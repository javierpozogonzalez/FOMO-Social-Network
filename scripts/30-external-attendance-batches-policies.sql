-- RLS policies for external_attendance_batches so venue owners can manage their own external attendance lots
-- Ejecutar en Supabase SQL editor
-- Asegúrate de que la tabla ya existe con columnas al menos:
--   id (uuid PK), event_id (uuid FK events.id), venue_id (uuid), source (text), quantity (int), notes (text), proof_image_url (text), verified (bool), created_at timestamptz
-- Esta configuración asume:
--   events.venue_id = venue_applications.id
--   venue_applications.user_id = auth.uid() del dueño del venue

alter table public.external_attendance_batches enable row level security;

-- Política SELECT: permitir leer a cualquier usuario autenticado (si quieres limitar luego, cámbiala)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='external_attendance_batches' AND policyname='Select external batches auth'
  ) THEN
    CREATE POLICY "Select external batches auth"
    ON public.external_attendance_batches FOR SELECT
    TO authenticated
    USING ( true );
  END IF;
END$$;

-- Política INSERT: sólo dueño del venue del evento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='external_attendance_batches' AND policyname='Insert external batches owner'
  ) THEN
    CREATE POLICY "Insert external batches owner"
    ON public.external_attendance_batches FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.venue_applications v ON e.venue_id = v.id
        WHERE e.id = event_id
          AND v.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Política UPDATE: sólo dueño del venue y sobre sus propias filas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='external_attendance_batches' AND policyname='Update external batches owner'
  ) THEN
    CREATE POLICY "Update external batches owner"
    ON public.external_attendance_batches FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.venue_applications v ON e.venue_id = v.id
        WHERE e.id = external_attendance_batches.event_id
          AND v.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.venue_applications v ON e.venue_id = v.id
        WHERE e.id = event_id
          AND v.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Política DELETE: sólo dueño del venue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='external_attendance_batches' AND policyname='Delete external batches owner'
  ) THEN
    CREATE POLICY "Delete external batches owner"
    ON public.external_attendance_batches FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.venue_applications v ON e.venue_id = v.id
        WHERE e.id = external_attendance_batches.event_id
          AND v.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- (Opcional) Política SELECT pública pero sólo cantidad agregada mediante una VIEW, no incluida aquí.

-- Recomendado: índice para acelerar join por event_id
CREATE INDEX IF NOT EXISTS external_attendance_batches_event_id_idx ON public.external_attendance_batches(event_id);
