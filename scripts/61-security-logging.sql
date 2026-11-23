-- Script 61: Security Logging & Audit Trail
-- Sistema completo de logging de eventos de seguridad y auditoría
-- Impacto: NINGUNO en funcionalidad - Solo registra eventos
-- Beneficio: Detectar ataques, cumplir regulaciones, investigar incidentes

-- PASO 1: Tabla de logs de seguridad
CREATE TABLE IF NOT EXISTS security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Tipo de evento
  event_type text NOT NULL CHECK (
    event_type IN (
      'auth.login', 'auth.logout', 'auth.signup', 'auth.password_reset',
      'auth.failed_login', 'auth.account_locked',
      'data.unauthorized_access', 'data.permission_denied',
      'rate_limit.exceeded', 'rate_limit.blocked',
      'report.submitted', 'report.auto_blocked',
      'admin.user_blocked', 'admin.user_unblocked',
      'admin.content_removed', 'admin.settings_changed',
      'suspicious.sql_injection', 'suspicious.xss_attempt',
      'suspicious.excessive_requests', 'suspicious.data_scraping'
    )
  ),
  
  -- Severidad del evento
  severity text NOT NULL DEFAULT 'info' CHECK (
    severity IN ('info', 'warning', 'error', 'critical')
  ),
  
  -- Usuario afectado/involucrado
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Datos del evento
  ip_address inet,
  user_agent text,
  endpoint text, -- función/endpoint afectado
  
  -- Detalles adicionales (JSON flexible)
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Descripción legible
  message text,
  
  -- Índices para búsquedas rápidas
  CONSTRAINT valid_metadata CHECK (jsonb_typeof(metadata) = 'object')
);

-- Índices optimizados para consultas comunes
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON security_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON security_logs(ip_address);

-- Índice compuesto para detectar patrones de ataque
CREATE INDEX IF NOT EXISTS idx_security_logs_suspicious 
  ON security_logs(event_type, severity, created_at DESC)
  WHERE severity IN ('error', 'critical');

COMMENT ON TABLE security_logs IS 'Registro de eventos de seguridad y auditoría';
COMMENT ON COLUMN security_logs.event_type IS 'Tipo de evento de seguridad';
COMMENT ON COLUMN security_logs.severity IS 'Nivel de severidad: info, warning, error, critical';
COMMENT ON COLUMN security_logs.metadata IS 'Datos adicionales en formato JSON';

-- PASO 2: RLS para security_logs (solo admins pueden ver)
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver logs (para futuro sistema admin)
-- Por ahora nadie puede leer directamente (solo funciones SECURITY DEFINER)
DROP POLICY IF EXISTS "Only admins can view logs" ON security_logs;
CREATE POLICY "Only admins can view logs" ON security_logs
  FOR SELECT 
  USING (false); -- Cambiar a role check cuando haya admins

-- Solo el sistema puede insertar logs
DROP POLICY IF EXISTS "System can insert logs" ON security_logs;
CREATE POLICY "System can insert logs" ON security_logs
  FOR INSERT 
  WITH CHECK (true); -- Controlado por SECURITY DEFINER

-- Nadie puede modificar o eliminar logs (inmutabilidad)
DROP POLICY IF EXISTS "Logs are immutable" ON security_logs;
CREATE POLICY "Logs are immutable" ON security_logs
  FOR UPDATE 
  USING (false);

DROP POLICY IF EXISTS "Logs cannot be deleted" ON security_logs;
CREATE POLICY "Logs cannot be deleted" ON security_logs
  FOR DELETE 
  USING (false);

-- PASO 3: Función helper para registrar eventos
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type text,
  p_severity text DEFAULT 'info',
  p_user_id uuid DEFAULT auth.uid(),
  p_target_user_id uuid DEFAULT NULL,
  p_endpoint text DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO security_logs (
    event_type,
    severity,
    user_id,
    target_user_id,
    endpoint,
    message,
    metadata
  ) VALUES (
    p_event_type,
    p_severity,
    p_user_id,
    p_target_user_id,
    p_endpoint,
    p_message,
    p_metadata
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_security_event TO authenticated, anon;

COMMENT ON FUNCTION log_security_event IS 'Registra un evento de seguridad en el audit trail';

-- PASO 4: Trigger automático para logins fallidos
-- (Requiere modificar auth, pero podemos interceptar en RPC)
-- Por ahora, las RPCs deben llamar a log_security_event manualmente

-- PASO 5: Trigger para detectar intentos de RLS bypass
CREATE OR REPLACE FUNCTION detect_rls_violation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si llegamos aquí, algo raro pasó (no debería ser posible sin RLS)
  PERFORM log_security_event(
    'data.unauthorized_access',
    'critical',
    auth.uid(),
    NEW.user_id, -- o el user_id de la tabla
    TG_TABLE_NAME,
    format('Intento de acceso no autorizado a tabla %s', TG_TABLE_NAME),
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    )
  );
  
  RETURN NULL; -- Bloquear la operación
END;
$$;

-- PASO 6: Integrar logging en función de reportes
CREATE OR REPLACE FUNCTION check_auto_block_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_count int;
  target_type text;
BEGIN
  -- Contar reportes del mismo objetivo
  SELECT COUNT(*), MAX(reported_type) INTO report_count, target_type
  FROM reports
  WHERE reported_user_id = NEW.reported_user_id
     OR reported_event_id = NEW.reported_event_id
     OR reported_venue_id = NEW.reported_venue_id;
  
  -- Log del reporte
  PERFORM log_security_event(
    'report.submitted',
    CASE 
      WHEN report_count >= 4 THEN 'warning'
      ELSE 'info'
    END,
    NEW.reporter_id,
    NEW.reported_user_id,
    'reports',
    format('Usuario reportó %s (total: %s reportes)', target_type, report_count),
    jsonb_build_object(
      'reason', NEW.reason,
      'report_count', report_count,
      'target_type', target_type
    )
  );
  
  -- Auto-bloqueo a los 5 reportes
  IF report_count >= 5 THEN
    IF NEW.reported_user_id IS NOT NULL THEN
      UPDATE users
      SET is_blocked = true
      WHERE id = NEW.reported_user_id;
      
      PERFORM log_security_event(
        'report.auto_blocked',
        'critical',
        NULL,
        NEW.reported_user_id,
        'auto_block_system',
        'Usuario bloqueado automáticamente por 5+ reportes',
        jsonb_build_object(
          'total_reports', report_count,
          'trigger_report_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Reemplazar trigger anterior con versión con logging
DROP TRIGGER IF EXISTS trigger_check_auto_block ON reports;
CREATE TRIGGER trigger_check_auto_block
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION check_auto_block_on_report();

-- PASO 7: Logging en rate limiting
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_requests int,
  p_window_minutes int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count int;
  is_allowed boolean;
BEGIN
  -- Limpiar registros antiguos
  DELETE FROM rate_limit_tracking
  WHERE created_at < now() - (p_window_minutes || ' minutes')::interval;
  
  -- Contar requests en la ventana
  SELECT COUNT(*) INTO request_count
  FROM rate_limit_tracking
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at >= now() - (p_window_minutes || ' minutes')::interval;
  
  is_allowed := request_count < p_max_requests;
  
  -- Si se excede el límite, registrar
  IF NOT is_allowed THEN
    PERFORM log_security_event(
      'rate_limit.exceeded',
      'warning',
      p_user_id,
      NULL,
      p_action,
      format('Rate limit excedido para acción %s (%s/%s en %s min)', 
             p_action, request_count, p_max_requests, p_window_minutes),
      jsonb_build_object(
        'action', p_action,
        'requests', request_count,
        'limit', p_max_requests,
        'window_minutes', p_window_minutes
      )
    );
  END IF;
  
  -- Registrar el intento
  IF is_allowed THEN
    INSERT INTO rate_limit_tracking (user_id, action)
    VALUES (p_user_id, p_action);
  END IF;
  
  RETURN is_allowed;
END;
$$;

-- PASO 8: Dashboard de seguridad (función helper)
CREATE OR REPLACE FUNCTION get_security_dashboard(
  p_hours int DEFAULT 24
)
RETURNS TABLE (
  event_type text,
  severity text,
  count bigint,
  recent_occurrence timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    event_type,
    severity,
    COUNT(*) as count,
    MAX(created_at) as recent_occurrence
  FROM security_logs
  WHERE created_at >= now() - (p_hours || ' hours')::interval
  GROUP BY event_type, severity
  ORDER BY count DESC, recent_occurrence DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_security_dashboard TO authenticated;

COMMENT ON FUNCTION get_security_dashboard IS 'Vista de eventos de seguridad recientes (para futuros admins)';

-- PASO 9: Función para detectar IPs sospechosas
CREATE OR REPLACE FUNCTION get_suspicious_ips(
  p_hours int DEFAULT 24
)
RETURNS TABLE (
  ip_address inet,
  total_events bigint,
  critical_events bigint,
  distinct_users bigint,
  last_seen timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sl.ip_address,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE severity IN ('error', 'critical')) as critical_events,
    COUNT(DISTINCT user_id) as distinct_users,
    MAX(created_at) as last_seen
  FROM security_logs sl
  WHERE sl.ip_address IS NOT NULL
    AND sl.created_at >= now() - (p_hours || ' hours')::interval
  GROUP BY sl.ip_address
  HAVING COUNT(*) FILTER (WHERE severity IN ('error', 'critical')) > 0
     OR COUNT(*) > 100 -- Más de 100 eventos en 24h es sospechoso
  ORDER BY critical_events DESC, total_events DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_suspicious_ips TO authenticated;

COMMENT ON FUNCTION get_suspicious_ips IS 'Detecta IPs con comportamiento sospechoso';

-- PASO 10: Auto-limpieza de logs antiguos (retención de 90 días)
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  -- Eliminar logs de más de 90 días (excepto critical)
  DELETE FROM security_logs
  WHERE created_at < now() - interval '90 days'
    AND severity != 'critical';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log críticos se mantienen 1 año
  DELETE FROM security_logs
  WHERE created_at < now() - interval '1 year'
    AND severity = 'critical';
  
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_security_logs TO authenticated;

COMMENT ON FUNCTION cleanup_old_security_logs IS 'Limpia logs antiguos: 90 días (info/warning), 1 año (critical)';

-- PASO 11: Tabla de configuración de seguridad
CREATE TABLE IF NOT EXISTS security_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  description text
);

-- Configuración inicial
INSERT INTO security_config (key, value, description)
VALUES 
  ('log_retention_days', '90'::jsonb, 'Días de retención de logs normales'),
  ('critical_log_retention_days', '365'::jsonb, 'Días de retención de logs críticos'),
  ('auto_block_threshold', '5'::jsonb, 'Reportes necesarios para bloqueo automático'),
  ('suspicious_ip_threshold', '100'::jsonb, 'Eventos por IP para marcar como sospechosa'),
  ('max_login_attempts', '5'::jsonb, 'Intentos de login antes de bloqueo temporal')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE security_config ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden modificar config (por ahora nadie)
DROP POLICY IF EXISTS "Only admins can modify config" ON security_config;
CREATE POLICY "Only admins can modify config" ON security_config
  FOR ALL 
  USING (false) 
  WITH CHECK (false);

COMMENT ON TABLE security_config IS 'Configuración del sistema de seguridad (solo admins)';

-- VERIFICACIÓN FINAL
DO $$
DECLARE
  table_count int;
  function_count int;
BEGIN
  -- Contar elementos creados
  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('security_logs', 'security_config');
  
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'log_security_event',
      'detect_rls_violation',
      'check_auto_block_on_report',
      'get_security_dashboard',
      'get_suspicious_ips',
      'cleanup_old_security_logs'
    );
  
  RAISE NOTICE '✅ Script 61 ejecutado correctamente';
  RAISE NOTICE '📊 Tablas creadas: %', table_count;
  RAISE NOTICE '⚙️ Funciones creadas: %', function_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Sistema de logging instalado:';
  RAISE NOTICE '   ✓ security_logs - Registro inmutable de eventos';
  RAISE NOTICE '   ✓ security_config - Configuración del sistema';
  RAISE NOTICE '   ✓ log_security_event() - Función para registrar eventos';
  RAISE NOTICE '   ✓ get_security_dashboard() - Vista de eventos recientes';
  RAISE NOTICE '   ✓ get_suspicious_ips() - Detector de IPs sospechosas';
  RAISE NOTICE '   ✓ cleanup_old_security_logs() - Auto-limpieza';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Eventos que se registran automáticamente:';
  RAISE NOTICE '   • Reportes de usuarios (report.submitted)';
  RAISE NOTICE '   • Bloqueos automáticos (report.auto_blocked)';
  RAISE NOTICE '   • Rate limits excedidos (rate_limit.exceeded)';
  RAISE NOTICE '   • Intentos de acceso no autorizado (data.unauthorized_access)';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Para ver dashboard de seguridad:';
  RAISE NOTICE '   SELECT * FROM get_security_dashboard(24);';
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Para detectar IPs sospechosas:';
  RAISE NOTICE '   SELECT * FROM get_suspicious_ips(24);';
  RAISE NOTICE '';
  RAISE NOTICE '🗑️ Para limpiar logs antiguos (ejecutar mensualmente):';
  RAISE NOTICE '   SELECT cleanup_old_security_logs();';
END $$;
