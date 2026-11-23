-- 53-rate-limiting-system.sql
-- Rate limiting básico para eventos y mensajes

BEGIN;

-- Tabla para registrar acciones
CREATE TABLE IF NOT EXISTS action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL, -- 'create_event', 'send_message', etc
  created_at timestamptz DEFAULT now()
);

-- Función para verificar límite de eventos por día
CREATE OR REPLACE FUNCTION can_create_event_today(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  count_today int;
BEGIN
  SELECT count(*) INTO count_today
  FROM action_logs
  WHERE user_id = p_user_id
    AND action = 'create_event'
    AND created_at::date = now()::date;
  RETURN count_today < 10; -- Máximo 10 eventos por día
END $$;

-- Función para verificar límite de mensajes por hora
CREATE OR REPLACE FUNCTION can_send_message_hourly(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  count_hour int;
BEGIN
  SELECT count(*) INTO count_hour
  FROM action_logs
  WHERE user_id = p_user_id
    AND action = 'send_message'
    AND date_trunc('hour', created_at) = date_trunc('hour', now());
  RETURN count_hour < 50; -- Máximo 50 mensajes por hora
END $$;

COMMIT;
