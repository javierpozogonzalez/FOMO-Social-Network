-- Añadir columnas de configuración de notificaciones a user_settings
-- Todas empiezan en FALSE para que el usuario active solo las que quiera

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS notif_friend_requests BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notif_friend_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notif_friend_event BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notif_venue_new_event BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notif_venue_reminder BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notif_event_chat BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notif_event_reminder BOOLEAN DEFAULT FALSE;

-- Comentarios para documentar cada campo
COMMENT ON COLUMN user_settings.notif_friend_requests IS 'Notificar cuando recibe solicitud de amistad';
COMMENT ON COLUMN user_settings.notif_friend_accepted IS 'Notificar cuando aceptan su solicitud de amistad';
COMMENT ON COLUMN user_settings.notif_friend_event IS 'Notificar cuando un amigo se apunta a un evento';
COMMENT ON COLUMN user_settings.notif_venue_new_event IS 'Notificar cuando un local favorito publica evento nuevo';
COMMENT ON COLUMN user_settings.notif_venue_reminder IS 'Recordatorios de eventos en locales favoritos';
COMMENT ON COLUMN user_settings.notif_event_chat IS 'Notificar mensajes nuevos en chats de eventos';
COMMENT ON COLUMN user_settings.notif_event_reminder IS 'Recordatorio de evento 24h antes';

-- Verificar que se añadieron correctamente
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_settings' 
  AND column_name LIKE 'notif_%'
ORDER BY column_name;
