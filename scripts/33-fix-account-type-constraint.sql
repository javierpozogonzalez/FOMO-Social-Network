-- Script 33: SOLUCIÓN COMPLETA PARA VENUES
-- Este script hace TODO lo necesario:
-- 1. Arregla el constraint de account_type
-- 2. Corrige venues existentes
-- 3. Borra sus amistades
-- 4. Actualiza la función approve_venue_application para futuras aprobaciones

-- ====================================================================
-- PASO 1: Eliminar el constraint antiguo
-- ====================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_type_check;

-- ====================================================================
-- PASO 2: Agregar el constraint corregido que incluye 'venue'
-- ====================================================================
ALTER TABLE users 
ADD CONSTRAINT users_account_type_check 
CHECK (account_type IN ('personal', 'user', 'venue', 'venue_free', 'venue_pro', 'venue_premium'));

-- ====================================================================
-- PASO 3: Borrar TODAS las amistades de venues existentes (ambas direcciones)
-- ====================================================================
DELETE FROM friendships
WHERE user_id IN (
  SELECT user_id FROM venue_applications WHERE status = 'approved'
)
OR friend_id IN (
  SELECT user_id FROM venue_applications WHERE status = 'approved'
);

-- ====================================================================
-- PASO 4: Corregir usuarios existentes que ya fueron aprobados
-- ====================================================================
UPDATE users
SET account_type = 'venue'
WHERE id IN (
  SELECT user_id 
  FROM venue_applications 
  WHERE status = 'approved'
)
AND (account_type IS NULL OR account_type NOT IN ('venue', 'venue_free', 'venue_pro', 'venue_premium'));

-- ====================================================================
-- PASO 5: Asegurar que venue_id esté correctamente asociado
-- ====================================================================
UPDATE users u
SET venue_id = va.id
FROM venue_applications va
WHERE u.id = va.user_id
  AND va.status = 'approved'
  AND (u.venue_id IS NULL OR u.venue_id != va.id);

-- ====================================================================
-- PASO 6: Crear/Actualizar la función approve_venue_application
-- Esta función se usará para FUTURAS aprobaciones
-- ====================================================================
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

  -- Marcar la solicitud como aprobada
  UPDATE venue_applications
  SET status = 'approved',
      reviewed_at = v_now,
      reviewed_by = p_admin_id
  WHERE id = p_app_id;

  -- IMPORTANTE: Borrar TODAS las amistades del usuario (ambas direcciones)
  -- Cuando alguien se convierte en venue, pierde todas sus amistades
  DELETE FROM friendships 
  WHERE user_id = v_user_id OR friend_id = v_user_id;

  -- Actualizar al usuario: convertir a venue y activar trial
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

COMMENT ON FUNCTION approve_venue_application(UUID, UUID, INTEGER) IS 
'Aprueba una solicitud de venue, borra sus amistades, y activa trial. Usar con service role.';

-- Seguridad
REVOKE ALL ON FUNCTION approve_venue_application(UUID, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_venue_application(UUID, UUID, INTEGER) TO service_role;

-- ====================================================================
-- PASO 7: Verificar resultado
-- ====================================================================
SELECT 
  u.id,
  u.full_name,
  u.email,
  u.account_type,
  u.venue_id,
  va.venue_name,
  va.status as application_status,
  (SELECT COUNT(*) FROM friendships WHERE user_id = u.id OR friend_id = u.id) as friendship_count
FROM users u
LEFT JOIN venue_applications va ON va.user_id = u.id
WHERE va.status = 'approved'
ORDER BY u.full_name;

-- Si friendship_count es > 0 para algún venue, hay un problema
-- Debería ser 0 para TODOS los venues
