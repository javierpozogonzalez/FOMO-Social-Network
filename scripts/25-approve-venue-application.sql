-- Función para aprobar una solicitud de cuenta profesional y activar el trial
-- Uso recomendado: ejecutar desde el SQL editor o desde una Edge Function con la service_role key
-- NO exponer esta función directamente al cliente móvil.

CREATE OR REPLACE FUNCTION approve_venue_application(
  p_app_id UUID,
  p_admin_id UUID DEFAULT NULL,
  p_trial_days INTEGER DEFAULT 30
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_trial_end TIMESTAMPTZ := NOW() + (p_trial_days || ' days')::INTERVAL;
  v_current_month INTEGER := EXTRACT(MONTH FROM NOW());
  v_current_year INTEGER := EXTRACT(YEAR FROM NOW());
BEGIN
  -- Bloquear la solicitud para evitar condiciones de carrera
  SELECT user_id INTO v_user_id
  FROM venue_applications
  WHERE id = p_app_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'approve_venue_application: application % not found', p_app_id;
  END IF;

  -- Marcar la solicitud como aprobada (idempotente: si ya está approved, reescribe reviewed_at/by)
  UPDATE venue_applications
  SET status = 'approved',
      reviewed_at = v_now,
      reviewed_by = p_admin_id
  WHERE id = p_app_id;

  -- IMPORTANTE: Borrar todas las amistades del usuario en ambas direcciones
  -- Cuando alguien se convierte en venue, pierde sus amistades
  DELETE FROM friendships 
  WHERE user_id = v_user_id OR friend_id = v_user_id;

  -- Actualizar al usuario: asociar venue_id y activar periodo de prueba
  UPDATE users
  SET account_type = 'venue',
      venue_id = p_app_id,
      subscription_status = 'trial',
      trial_ends_at = v_trial_end
  WHERE id = v_user_id;

  -- Inicializar uso mensual si no existe
  INSERT INTO venue_usage (user_id, month, year, events_created, events_featured, notifications_sent)
  VALUES (v_user_id, v_current_month, v_current_year, 0, 0, 0)
  ON CONFLICT (user_id, month, year) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION approve_venue_application(UUID, UUID, INTEGER) IS 'Aprueba una solicitud de venue (venue_applications) y activa trial de p_trial_days; usar con service role.';

-- Seguridad: por defecto no conceder a PUBLIC
REVOKE ALL ON FUNCTION approve_venue_application(UUID, UUID, INTEGER) FROM PUBLIC;
-- Conceder a service_role para uso desde Edge Functions / servidor
GRANT EXECUTE ON FUNCTION approve_venue_application(UUID, UUID, INTEGER) TO service_role;
