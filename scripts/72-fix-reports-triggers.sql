-- 72-fix-reports-triggers.sql
-- Corrige funciones/triggers de reportes que referencian columnas inexistentes
-- (reported_user_id / reported_event_id / reported_venue_id) y los adapta
-- al esquema actual: reported_type + reported_id.

BEGIN;

-- Reemplazar función con logging para usar reported_type/reported_id
CREATE OR REPLACE FUNCTION public.check_auto_block_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_count int;
  target_type text;
  target_id uuid;
  target_user uuid;
BEGIN
  target_type := NEW.reported_type;
  target_id := NEW.reported_id;

  -- Contar reportes del mismo objetivo
  SELECT COUNT(*) INTO report_count
  FROM public.reports
  WHERE reported_type = target_type
    AND reported_id = target_id;

  -- Log del reporte (solo ponemos target_user_id si el objetivo es usuario)
  IF target_type = 'user' THEN
    target_user := target_id;
  ELSE
    target_user := NULL;
  END IF;

  PERFORM public.log_security_event(
    'report.submitted',
    CASE WHEN report_count >= 4 THEN 'warning' ELSE 'info' END,
    NEW.reporter_id,
    target_user,
    'reports',
    format('Usuario reportó %s (%s) - total: %s', target_type, target_id, report_count),
    jsonb_build_object(
      'reason', NEW.reason,
      'target_type', target_type,
      'target_id', target_id,
      'report_count', report_count
    )
  );

  -- Auto bloqueo opcional: solo para tipo 'user'.
  -- Nota: Evitamos UPDATE si la columna users.is_blocked no existe.
  -- Si quieres activarlo, crea la columna y descomenta el UPDATE.
  /*
  IF target_type = 'user' AND report_count >= 5 THEN
    UPDATE users SET is_blocked = true WHERE id = target_id;
    PERFORM public.log_security_event(
      'report.auto_blocked', 'critical', NULL, target_id, 'auto_block_system',
      'Usuario bloqueado automáticamente por 5+ reportes',
      jsonb_build_object('total_reports', report_count, 'trigger_report_id', NEW.id)
    );
  END IF;
  */

  RETURN NEW;
END;
$$;

-- Asegurar trigger AFTER INSERT sobre reports
DROP TRIGGER IF EXISTS trigger_check_auto_block ON public.reports;
CREATE TRIGGER trigger_check_auto_block
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.check_auto_block_on_report();

COMMIT;
