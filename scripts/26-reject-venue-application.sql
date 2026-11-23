-- Función para rechazar una solicitud de cuenta profesional
-- Uso recomendado: ejecutar desde SQL editor o Edge Function con service_role
-- No modifica el estado del usuario, solo marca la solicitud como rechazada.

CREATE OR REPLACE FUNCTION reject_venue_application(
  p_app_id UUID,
  p_admin_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'No cumple los criterios'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Verificar existencia de la solicitud
  SELECT EXISTS(SELECT 1 FROM venue_applications WHERE id = p_app_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'reject_venue_application: application % not found', p_app_id;
  END IF;

  -- Marcar como rechazada y registrar motivo y revisor
  UPDATE venue_applications
  SET status = 'rejected',
      rejection_reason = p_reason,
      reviewed_at = NOW(),
      reviewed_by = p_admin_id
  WHERE id = p_app_id;
END;
$$;

COMMENT ON FUNCTION reject_venue_application(UUID, UUID, TEXT) IS 'Rechaza una solicitud de venue con motivo y marca temporal; no cambia el estado del usuario.';

-- Seguridad
REVOKE ALL ON FUNCTION reject_venue_application(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reject_venue_application(UUID, UUID, TEXT) TO service_role;
