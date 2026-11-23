-- Script 70: Corregir RLS de event_attendees para permitir leer asistentes visibles
-- Fecha: 16-11-2025
-- Problema detectado: la política de lectura exigía status='confirmed',
-- pero la app usa status='going' para los apuntados visibles. Resultado: los
-- usuarios solo veían su propia asistencia.

BEGIN;

-- Restaurar política de lectura "visible para todos" (usuarios autenticados)
DROP POLICY IF EXISTS "Anyone can view visible attendees" ON public.event_attendees;
CREATE POLICY "Anyone can view visible attendees" ON public.event_attendees
FOR SELECT TO authenticated
USING (
  is_visible = true
);

-- Mantener política de gestión propia (insert/update/delete) sin cambios
DROP POLICY IF EXISTS "Users can manage own attendance" ON public.event_attendees;
CREATE POLICY "Users can manage own attendance" ON public.event_attendees
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

DO $$
BEGIN
  RAISE NOTICE '✅ RLS de event_attendees corregida: lectura por is_visible=true';
END $$;

COMMIT;