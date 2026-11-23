-- ================================================
-- SOLUCIÓN SIMPLE: Usuario puede eliminar su propia cuenta
-- ================================================
-- Esta solución permite que el usuario elimine su cuenta directamente
-- desde el cliente, sin necesidad de Edge Functions

-- 1. Permitir que usuarios eliminen su propio perfil
CREATE POLICY "Users can delete their own profile"
ON users
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- 2. Políticas para eliminar datos relacionados (basado en tu BD actual)

-- Friendships
CREATE POLICY "Users can delete their own friendships"
ON friendships
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR friend_id = auth.uid());

-- Event attendees
CREATE POLICY "Users can delete their own attendance"
ON event_attendees
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Notification tokens
CREATE POLICY "Users can delete their own notification tokens"
ON notification_tokens
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Venue followers
CREATE POLICY "Users can delete their own venue follows"
ON venue_followers
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Events creados por el usuario
CREATE POLICY "Users can delete their own events"
ON events
FOR DELETE
TO authenticated
USING (creator_id = auth.uid());

-- User settings
CREATE POLICY "Users can delete their own settings"
ON user_settings
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Venue applications (si el usuario creó una)
CREATE POLICY "Users can delete their own venue applications"
ON venue_applications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- External attendance batches (si el usuario las creó)
CREATE POLICY "Users can delete their own attendance batches"
ON external_attendance_batches
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Verificar todas las políticas DELETE creadas
SELECT 
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE cmd = 'DELETE'
  AND tablename IN ('users', 'friendships', 'event_attendees', 'notification_tokens',
                     'venue_followers', 'events', 'user_settings', 'venue_applications',
                     'external_attendance_batches')
ORDER BY tablename, policyname;
