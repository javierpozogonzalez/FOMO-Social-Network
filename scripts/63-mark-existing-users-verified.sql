-- 63-mark-existing-users-verified.sql
-- Objetivo: Marcar usuarios existentes como verificados para no bloquearlos
-- Contexto: El sistema de verificación de email es NUEVO, solo debe aplicar a usuarios nuevos
-- Impacto: CERO en funcionalidad - Solo marca usuarios antiguos como verificados

DO $$
DECLARE
  updated_count int;
BEGIN
  -- Actualizar usuarios que NO tienen email_verified definido (NULL o no existe)
  -- Estos son usuarios que se registraron ANTES del sistema de verificación
  UPDATE users
  SET email_verified = true
  WHERE email_verified IS NULL
     OR email_verified IS NOT DISTINCT FROM NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Usuarios existentes marcados como verificados: %', updated_count;
  
  IF updated_count = 0 THEN
    RAISE NOTICE '📝 No había usuarios sin verificar (todos ya tenían email_verified definido)';
  ELSE
    RAISE NOTICE '🎉 % usuarios antiguos ahora pueden acceder sin problemas', updated_count;
  END IF;
END $$;

-- Verificación: Ver estado de verificación
DO $$
DECLARE
  total_users int;
  verified_users int;
  unverified_users int;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO verified_users FROM users WHERE email_verified = true;
  SELECT COUNT(*) INTO unverified_users FROM users WHERE email_verified = false;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 Estado de verificación de emails:';
  RAISE NOTICE '   Total usuarios: %', total_users;
  RAISE NOTICE '   ✅ Verificados: %', verified_users;
  RAISE NOTICE '   ⏳ Sin verificar: %', unverified_users;
  RAISE NOTICE '';
  RAISE NOTICE '💡 Los usuarios "sin verificar" son nuevos registros que deben completar verificación';
  RAISE NOTICE '💡 Los usuarios "verificados" pueden acceder normalmente';
END $$;

COMMENT ON COLUMN users.email_verified IS 'Indica si el email ha sido verificado. NULL o true = acceso permitido, false = requiere verificación';
