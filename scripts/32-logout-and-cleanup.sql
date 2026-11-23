-- LOGOUT Y LIMPIEZA PARA TESTING
-- Ejecuta esto en Supabase SQL Editor para hacer logout

-- 1. Eliminar el usuario de prueba juanperez@gmail.com
DELETE FROM auth.users WHERE email = 'juanperez@gmail.com';

-- 2. Limpiar códigos de verificación antiguos
DELETE FROM verification_codes WHERE created_at < NOW() - INTERVAL '1 hour';

-- 3. Verificar que onboarding@resend.dev puede recibir emails
-- (No hay que hacer nada, Resend ya permite este email)

-- ✅ AHORA PUEDES:
-- 1. Cerrar completamente la app en el móvil
-- 2. Abrirla de nuevo
-- 3. Hacer click en "Registrarse"
-- 4. Usar email: onboarding@resend.dev
-- 5. El código llegará al Dashboard de Resend (https://resend.com/emails)
