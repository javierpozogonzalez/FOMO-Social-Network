-- 71-remove-chat-and-create-reports.sql
-- Objetivo: eliminar el chat entre usuarios en eventos y crear el sistema unificado de reportes.
-- Supuestos: ya existe la tabla public.event_announcements (avisos del organizador) y la tabla public.events/public.users.
-- Idempotente y seguro para reruns.

BEGIN;

-- 0) Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) ELIMINAR CHAT ENTRE USUARIOS
--    Hay proyectos que usan "event_chats" (legacy con Realtime) o "event_chat_messages" (v2) y tablas auxiliares.
--    Eliminamos todo lo relacionado con chat de usuarios.

-- 1.1) Borrar RPCs/funciones que insertan o gestionan mensajes de chat
DO $$
BEGIN
  -- send_chat_message(p_event_id uuid, p_content text)
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'send_chat_message'
      AND pg_get_function_identity_arguments(oid) = 'p_event_id uuid, p_content text'
      AND pg_function_is_visible(oid)
  ) THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.send_chat_message(uuid, text)';
  END IF;

  -- delete_chat_message(p_message_id uuid)
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'delete_chat_message'
      AND pg_get_function_identity_arguments(oid) = 'p_message_id uuid'
      AND pg_function_is_visible(oid)
  ) THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.delete_chat_message(uuid)';
  END IF;
END$$;

-- 1.2) Eliminar tablas de chat si existen
DROP TABLE IF EXISTS public.message_reports CASCADE;         -- reportes de mensajes (obsoleto)
DROP TABLE IF EXISTS public.chat_rate_limits CASCADE;        -- rate limiting del chat (obsoleto)
DROP TABLE IF EXISTS public.event_chat_messages CASCADE;     -- variante v2 (si existe)
DROP TABLE IF EXISTS public.event_chats CASCADE;             -- tabla legacy principal de chat

-- Nota: Conservamos public.event_announcements (avisos del organizador)

-- 2) SISTEMA DE REPORTES
-- Ya existe una tabla `reports` (ver script 57) con columnas: reported_type, reported_id, reason, description, status, etc.
-- Aquí solo aseguramos limpieza de chats y reforzamos índices/RLS sin cambiar el esquema previo.

-- 2.1) Asegurar que la tabla reports existe (creada por script 57). Si NO existiera, crear versión mínima compatible.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reports') THEN
    CREATE TABLE public.reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      reported_type text NOT NULL CHECK (reported_type IN ('user','event','message','venue')),
      reported_id uuid NOT NULL,
      reason text NOT NULL,
      description text,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END$$;

-- 2.2) Asegurar RLS habilitado
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 2.3) Re-crear / asegurar índices existentes
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(reported_type);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- 2.4) Limpiar y recrear políticas básicas (sin cambiar semántica)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reports' AND policyname='Users can create reports') THEN
    EXECUTE 'DROP POLICY "Users can create reports" ON public.reports';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reports' AND policyname='Users can view own reports') THEN
    EXECUTE 'DROP POLICY "Users can view own reports" ON public.reports';
  END IF;
END$$;

CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- 2.5) (Opcional) Política para service_role moderación
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reports' AND policyname='reports_moderation_service_role') THEN
      EXECUTE 'CREATE POLICY reports_moderation_service_role ON public.reports FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;
  END IF;
END$$;

-- NOTA: No se migran columnas nuevas (tipo/target_user_id/target_event_id) para evitar ruptura con datos existentes.
-- La UI debe usar reported_type + reported_id.

COMMIT;
