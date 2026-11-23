-- Script 68: Eliminar completamente usuario pablopelopobregonzalez@gmail.com
-- Fecha: 15 de noviembre de 2025
-- Propósito: Permitir re-registro con el mismo email para testing

-- =============================================
-- PASO 1: Eliminar datos relacionados
-- =============================================

-- Eliminar asistencias a eventos
DELETE FROM event_attendees 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

-- Eliminar amistades (ambas direcciones)
DELETE FROM friendships 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
)
OR friend_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

-- Eliminar mensajes de chat
DELETE FROM event_chat_messages 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

DELETE FROM event_chats 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

-- Eliminar tokens de notificación
DELETE FROM notification_tokens 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

-- Eliminar códigos de verificación
DELETE FROM email_verification_codes 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

-- Eliminar configuraciones de usuario
DELETE FROM user_settings 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

-- Eliminar reportes
DELETE FROM reports 
WHERE reporter_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

DELETE FROM message_reports 
WHERE reporter_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

-- Eliminar eventos creados (si es venue)
DELETE FROM events 
WHERE created_by IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

-- Eliminar venue followers
DELETE FROM venue_followers 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com'
);

-- =============================================
-- PASO 2: Eliminar de tabla users
-- =============================================

DELETE FROM users 
WHERE email = 'pablopelopobregonzalez@gmail.com';

-- =============================================
-- PASO 3: Eliminar de auth.users (Supabase Auth)
-- =============================================

-- IMPORTANTE: Este paso debe hacerse desde el Dashboard de Supabase
-- Authentication → Users → Buscar pablopelopobregonzalez@gmail.com → Delete User

-- O ejecutar este SQL en la tabla auth.users (requiere permisos de service_role):
-- DELETE FROM auth.users WHERE email = 'pablopelopobregonzalez@gmail.com';

-- =============================================
-- VERIFICACIÓN
-- =============================================

-- Verificar que no queden datos
SELECT 
  (SELECT COUNT(*) FROM users WHERE email = 'pablopelopobregonzalez@gmail.com') as usuarios_restantes,
  (SELECT COUNT(*) FROM event_attendees WHERE user_id IN (SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com')) as asistencias_restantes,
  (SELECT COUNT(*) FROM friendships WHERE user_id IN (SELECT id FROM users WHERE email = 'pablopelopobregonzalez@gmail.com')) as amistades_restantes;

-- Resultado esperado:
-- usuarios_restantes: 0
-- asistencias_restantes: 0
-- amistades_restantes: 0

DO $$
BEGIN
  RAISE NOTICE '✅ Script 68 ejecutado';
  RAISE NOTICE '⚠️ IMPORTANTE: Debes eliminar el usuario de auth.users manualmente en el Dashboard';
  RAISE NOTICE '📍 Authentication → Users → pablopelopobregonzalez@gmail.com → Delete User';
END $$;
