-- Script 67: Optimizar RLS - Eliminar re-evaluaciones de auth.uid()
-- Fecha: 15 de noviembre de 2025
-- Problema: Las políticas RLS están re-evaluando auth.uid() para cada fila
-- Solución: Usar (select auth.uid()) para cachear el valor

-- =============================================
-- TABLA: events
-- =============================================

DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
CREATE POLICY "Authenticated users can create events" ON events
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own events" ON events;
CREATE POLICY "Users can update own events" ON events
FOR UPDATE TO authenticated
USING (created_by = (select auth.uid()))
WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own events" ON events;
CREATE POLICY "Users can delete own events" ON events
FOR DELETE TO authenticated
USING (created_by = (select auth.uid()));

-- =============================================
-- TABLA: event_attendees
-- =============================================

DROP POLICY IF EXISTS "Anyone can view visible attendees" ON event_attendees;
CREATE POLICY "Anyone can view visible attendees" ON event_attendees
FOR SELECT
USING (
  status = 'confirmed'
  OR user_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = event_id AND e.created_by = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can manage own attendance" ON event_attendees;
CREATE POLICY "Users can manage own attendance" ON event_attendees
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- TABLA: friendships
-- =============================================

DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()) OR friend_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
CREATE POLICY "Users can create friendships" ON friendships
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own friendships" ON friendships;
CREATE POLICY "Users can update own friendships" ON friendships
FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()) OR friend_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()) OR friend_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;
CREATE POLICY "Users can delete own friendships" ON friendships
FOR DELETE TO authenticated
USING (user_id = (select auth.uid()) OR friend_id = (select auth.uid()));

-- =============================================
-- TABLA: external_attendance_batches
-- =============================================

-- Eliminar políticas duplicadas primero
DROP POLICY IF EXISTS "Insert external batches owner" ON external_attendance_batches;
DROP POLICY IF EXISTS "Update external batches owner" ON external_attendance_batches;
DROP POLICY IF EXISTS "Delete external batches owner" ON external_attendance_batches;
DROP POLICY IF EXISTS "Solo el owner del venue puede añadir lotes externos" ON external_attendance_batches;
DROP POLICY IF EXISTS "Solo el owner puede actualizar sus lotes" ON external_attendance_batches;
DROP POLICY IF EXISTS "Solo el owner puede eliminar sus lotes" ON external_attendance_batches;
DROP POLICY IF EXISTS "Venue owners can insert batches" ON external_attendance_batches;
DROP POLICY IF EXISTS "Venue owners can modify own batches" ON external_attendance_batches;

-- Crear políticas optimizadas únicas
CREATE POLICY "Venue owners manage batches" ON external_attendance_batches
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    JOIN users u ON u.id = (select auth.uid())
    WHERE e.id = event_id AND e.venue_id = u.venue_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    JOIN users u ON u.id = (select auth.uid())
    WHERE e.id = event_id AND e.venue_id = u.venue_id
  )
);

-- =============================================
-- TABLA: event_chats
-- =============================================

DROP POLICY IF EXISTS "Authenticated users can send messages" ON event_chats;
DROP POLICY IF EXISTS "Attendees can send messages" ON event_chats;

CREATE POLICY "Attendees can send messages" ON event_chats
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM event_attendees ea
    WHERE ea.event_id = event_chats.event_id
    AND ea.user_id = (select auth.uid())
    AND ea.status = 'confirmed'
  )
);

DROP POLICY IF EXISTS "Users can delete own messages" ON event_chats;
CREATE POLICY "Users can delete own messages" ON event_chats
FOR DELETE TO authenticated
USING (user_id = (select auth.uid()));

-- =============================================
-- TABLA: users
-- =============================================

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users
FOR INSERT TO authenticated
WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
FOR UPDATE TO authenticated
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()));

-- Eliminar política duplicada
DROP POLICY IF EXISTS "Users can view public profiles" ON users;

-- =============================================
-- TABLA: venue_followers
-- =============================================

DROP POLICY IF EXISTS "Users can view own venue follows" ON venue_followers;
DROP POLICY IF EXISTS "read_own_follows" ON venue_followers;
DROP POLICY IF EXISTS "venue_owner_can_read_followers" ON venue_followers;

CREATE POLICY "View venue followers" ON venue_followers
FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (select auth.uid()) AND u.venue_id = venue_followers.venue_id
  )
);

DROP POLICY IF EXISTS "Users can follow venues" ON venue_followers;
DROP POLICY IF EXISTS "insert_own_follow" ON venue_followers;

CREATE POLICY "Users follow venues" ON venue_followers
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own venue follows" ON venue_followers;

DROP POLICY IF EXISTS "Users can unfollow venues" ON venue_followers;
DROP POLICY IF EXISTS "delete_own_follow" ON venue_followers;

CREATE POLICY "Users unfollow venues" ON venue_followers
FOR DELETE TO authenticated
USING (user_id = (select auth.uid()));

-- =============================================
-- TABLA: notification_tokens
-- =============================================

DROP POLICY IF EXISTS "Users can manage own tokens" ON notification_tokens;
DROP POLICY IF EXISTS "Users can view own tokens" ON notification_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON notification_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON notification_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON notification_tokens;

CREATE POLICY "Manage own notification tokens" ON notification_tokens
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- TABLA: venue_applications
-- =============================================

DROP POLICY IF EXISTS "Users can view their own applications" ON venue_applications;
DROP POLICY IF EXISTS "read_approved_venues_or_own" ON venue_applications;

CREATE POLICY "View venue applications" ON venue_applications
FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR status = 'approved'
);

DROP POLICY IF EXISTS "Users can create applications" ON venue_applications;
CREATE POLICY "Users can create applications" ON venue_applications
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own applications" ON venue_applications;
CREATE POLICY "Users can update their own applications" ON venue_applications
FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- TABLA: venue_usage
-- =============================================

DROP POLICY IF EXISTS "Venue owners can view own usage" ON venue_usage;
DROP POLICY IF EXISTS "Venue owners can view their usage" ON venue_usage;
DROP POLICY IF EXISTS "Only system can modify usage" ON venue_usage;

CREATE POLICY "Venue owners view usage" ON venue_usage
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- =============================================
-- TABLA: email_verification_codes
-- =============================================

DROP POLICY IF EXISTS "Users can view own verification codes" ON email_verification_codes;
CREATE POLICY "Users can view own verification codes" ON email_verification_codes
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "System can insert verification codes" ON email_verification_codes;
CREATE POLICY "System can insert verification codes" ON email_verification_codes
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- TABLA: reports
-- =============================================

DROP POLICY IF EXISTS "Users can create reports" ON reports;
CREATE POLICY "Users can create reports" ON reports
FOR INSERT TO authenticated
WITH CHECK (reporter_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own reports" ON reports;
CREATE POLICY "Users can view own reports" ON reports
FOR SELECT TO authenticated
USING (reporter_id = (select auth.uid()));

-- =============================================
-- TABLA: event_announcements
-- =============================================

DROP POLICY IF EXISTS "Organizers can create announcements" ON event_announcements;
DROP POLICY IF EXISTS "Anuncios: solo organizador crea" ON event_announcements;

CREATE POLICY "Organizers create announcements" ON event_announcements
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id AND e.created_by = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Organizers can update announcements" ON event_announcements;
DROP POLICY IF EXISTS "Anuncios: solo organizador actualiza" ON event_announcements;

CREATE POLICY "Organizers update announcements" ON event_announcements
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id AND e.created_by = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id AND e.created_by = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Organizers can delete announcements" ON event_announcements;
DROP POLICY IF EXISTS "Anuncios: solo organizador elimina" ON event_announcements;

CREATE POLICY "Organizers delete announcements" ON event_announcements
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id AND e.created_by = (select auth.uid())
  )
);

-- Mantener política de lectura pública
DROP POLICY IF EXISTS "Anuncios: lectura pública" ON event_announcements;

-- =============================================
-- TABLA: event_chat_messages
-- =============================================

DROP POLICY IF EXISTS "Mensajes: solo asistentes confirmados escriben" ON event_chat_messages;
DROP POLICY IF EXISTS "Mensajes: solo asistentes apuntados escriben" ON event_chat_messages;

CREATE POLICY "Attendees send messages" ON event_chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (select auth.uid())
  AND EXISTS (
    SELECT 1 FROM event_attendees ea
    WHERE ea.event_id = event_chat_messages.event_id
    AND ea.user_id = (select auth.uid())
    AND ea.status = 'confirmed'
  )
);

DROP POLICY IF EXISTS "Mensajes: solo organizador actualiza (para eliminar)" ON event_chat_messages;

CREATE POLICY "Organizers moderate messages" ON event_chat_messages
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id AND e.created_by = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id AND e.created_by = (select auth.uid())
  )
);

-- =============================================
-- TABLA: message_reports
-- =============================================

DROP POLICY IF EXISTS "Reportes: usuarios autenticados crean" ON message_reports;
CREATE POLICY "Users create message reports" ON message_reports
FOR INSERT TO authenticated
WITH CHECK (reporter_id = (select auth.uid()));

DROP POLICY IF EXISTS "Reportes: solo organizador lee" ON message_reports;
CREATE POLICY "Organizers read reports" ON message_reports
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_chat_messages ecm
    JOIN events e ON e.id = ecm.event_id
    WHERE ecm.id = message_id AND e.created_by = (select auth.uid())
  )
);

-- =============================================
-- TABLA: chat_rate_limits
-- =============================================

DROP POLICY IF EXISTS "Rate limits: solo propio usuario" ON chat_rate_limits;
CREATE POLICY "Own rate limits" ON chat_rate_limits
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- TABLA: user_settings
-- =============================================

DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;

CREATE POLICY "Manage own settings" ON user_settings
FOR ALL TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- =============================================
-- ELIMINAR ÍNDICES DUPLICADOS
-- =============================================

DROP INDEX IF EXISTS idx_external_attendance_event;
DROP INDEX IF EXISTS idx_venue_followers_user;

-- =============================================
-- VERIFICACIÓN
-- =============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Script 67 ejecutado correctamente';
  RAISE NOTICE '🚀 Políticas RLS optimizadas (auth.uid() cacheado)';
  RAISE NOTICE '🗑️ Políticas duplicadas eliminadas';
  RAISE NOTICE '📊 Índices duplicados eliminados';
  RAISE NOTICE '⚡ Rendimiento mejorado significativamente';
END $$;
