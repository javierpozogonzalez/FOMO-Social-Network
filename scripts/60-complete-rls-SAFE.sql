-- Script 60: Complete RLS Coverage (VERSIÓN SEGURA)
-- Añade RLS a tablas que faltaban y refuerza políticas existentes
-- SOLO actúa sobre tablas que EXISTEN - No falla si algo no está
-- Impacto: NINGUNO - Todo funciona igual, solo más seguro

-- ========================================
-- PASO 1: RLS en notification_tokens (si existe)
-- ========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_tokens') THEN
    
    ALTER TABLE notification_tokens ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own tokens" ON notification_tokens;
    DROP POLICY IF EXISTS "Users can insert own tokens" ON notification_tokens;
    DROP POLICY IF EXISTS "Users can update own tokens" ON notification_tokens;
    DROP POLICY IF EXISTS "Users can delete own tokens" ON notification_tokens;
    
    CREATE POLICY "Users can view own tokens" ON notification_tokens
      FOR SELECT USING (user_id = auth.uid());
    
    CREATE POLICY "Users can insert own tokens" ON notification_tokens
      FOR INSERT WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Users can update own tokens" ON notification_tokens
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Users can delete own tokens" ON notification_tokens
      FOR DELETE USING (user_id = auth.uid());
    
    RAISE NOTICE '✅ RLS configurado en notification_tokens';
  ELSE
    RAISE NOTICE '⏭️ notification_tokens no existe - saltando';
  END IF;
END $$;

-- ========================================
-- PASO 2: RLS en user_settings (si existe)
-- ========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
    
    ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
    DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
    DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
    
    CREATE POLICY "Users can view own settings" ON user_settings
      FOR SELECT USING (user_id = auth.uid());
    
    CREATE POLICY "Users can update own settings" ON user_settings
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Users can insert own settings" ON user_settings
      FOR INSERT WITH CHECK (user_id = auth.uid());
    
    RAISE NOTICE '✅ RLS reforzado en user_settings';
  ELSE
    RAISE NOTICE '⏭️ user_settings no existe - saltando';
  END IF;
END $$;

-- ========================================
-- PASO 3: RLS en event_announcements (si existe)
-- ========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_announcements') THEN
    
    ALTER TABLE event_announcements ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Anyone can view announcements" ON event_announcements;
    DROP POLICY IF EXISTS "Organizers can create announcements" ON event_announcements;
    DROP POLICY IF EXISTS "Organizers can update announcements" ON event_announcements;
    DROP POLICY IF EXISTS "Organizers can delete announcements" ON event_announcements;
    
    -- Todos pueden ver anuncios
    CREATE POLICY "Anyone can view announcements" ON event_announcements
      FOR SELECT USING (true);
    
    -- Solo organizadores pueden crear anuncios
    CREATE POLICY "Organizers can create announcements" ON event_announcements
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM events e
          JOIN venue_applications va ON e.venue_id = va.id
          WHERE e.id = event_announcements.event_id
            AND va.user_id = auth.uid()
        )
      );
    
    -- Solo organizadores pueden modificar sus anuncios
    CREATE POLICY "Organizers can update announcements" ON event_announcements
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM events e
          JOIN venue_applications va ON e.venue_id = va.id
          WHERE e.id = event_announcements.event_id
            AND va.user_id = auth.uid()
        )
      );
    
    CREATE POLICY "Organizers can delete announcements" ON event_announcements
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM events e
          JOIN venue_applications va ON e.venue_id = va.id
          WHERE e.id = event_announcements.event_id
            AND va.user_id = auth.uid()
        )
      );
    
    RAISE NOTICE '✅ RLS reforzado en event_announcements';
  ELSE
    RAISE NOTICE '⏭️ event_announcements no existe - saltando';
  END IF;
END $$;

-- ========================================
-- PASO 4: RLS en event_chats (reforzar)
-- ========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_chats') THEN
    
    ALTER TABLE event_chats ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Anyone can view event chats" ON event_chats;
    DROP POLICY IF EXISTS "Attendees can send messages" ON event_chats;
    DROP POLICY IF EXISTS "Users can delete own messages" ON event_chats;
    
    CREATE POLICY "Anyone can view event chats" ON event_chats
      FOR SELECT USING (true);
    
    -- Solo asistentes confirmados pueden escribir
    CREATE POLICY "Attendees can send messages" ON event_chats
      FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM event_attendees
          WHERE event_id = event_chats.event_id
            AND user_id = auth.uid()
            AND status = 'going'
        )
      );
    
    CREATE POLICY "Users can delete own messages" ON event_chats
      FOR DELETE USING (user_id = auth.uid());
    
    RAISE NOTICE '✅ RLS reforzado en event_chats';
  ELSE
    RAISE NOTICE '⏭️ event_chats no existe - saltando';
  END IF;
END $$;

-- ========================================
-- PASO 5: RLS en external_attendance_batches (si existe)
-- ========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'external_attendance_batches') THEN
    
    ALTER TABLE external_attendance_batches ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Anyone can view batches" ON external_attendance_batches;
    DROP POLICY IF EXISTS "Venue owners can insert batches" ON external_attendance_batches;
    DROP POLICY IF EXISTS "Venue owners can modify own batches" ON external_attendance_batches;
    
    CREATE POLICY "Anyone can view batches" ON external_attendance_batches
      FOR SELECT USING (true);
    
    -- Solo venue owner del evento puede insertar
    CREATE POLICY "Venue owners can insert batches" ON external_attendance_batches
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM events e
          JOIN venue_applications va ON e.venue_id = va.id
          WHERE e.id = external_attendance_batches.event_id
            AND va.user_id = auth.uid()
        )
      );
    
    -- Solo venue owner puede modificar/eliminar
    CREATE POLICY "Venue owners can modify own batches" ON external_attendance_batches
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM events e
          JOIN venue_applications va ON e.venue_id = va.id
          WHERE e.id = external_attendance_batches.event_id
            AND va.user_id = auth.uid()
        )
      );
    
    RAISE NOTICE '✅ RLS reforzado en external_attendance_batches';
  ELSE
    RAISE NOTICE '⏭️ external_attendance_batches no existe - saltando';
  END IF;
END $$;

-- ========================================
-- PASO 6: Función helper para verificar cobertura de RLS
-- ========================================
CREATE OR REPLACE FUNCTION check_rls_coverage()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.tablename::text,
    t.rowsecurity::boolean as rls_enabled,
    COUNT(p.policyname)::bigint as policy_count
  FROM pg_tables t
  LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
  WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%'
    AND t.tablename NOT LIKE 'sql_%'
  GROUP BY t.tablename, t.rowsecurity
  ORDER BY t.tablename;
$$;

GRANT EXECUTE ON FUNCTION check_rls_coverage() TO authenticated;

-- ========================================
-- PASO 7: Verificar cobertura de RLS en tablas críticas
-- ========================================
DO $$
DECLARE
  table_record record;
  missing_rls text[] := ARRAY[]::text[];
  critical_tables text[] := ARRAY[
    'users', 'events', 'event_attendees', 'friendships',
    'event_chats', 'event_announcements', 'user_settings',
    'venue_applications', 'venue_followers',
    'notification_tokens', 'external_attendance_batches',
    'reports', 'rate_limit_tracking'
  ];
BEGIN
  -- Verificar cada tabla crítica
  FOREACH table_record.tablename IN ARRAY critical_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename = table_record.tablename
    ) THEN
      -- Tabla existe, verificar RLS
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = table_record.tablename
          AND n.nspname = 'public'
          AND c.relrowsecurity = true
      ) THEN
        missing_rls := array_append(missing_rls, table_record.tablename);
        RAISE WARNING '⚠️ Tabla % NO tiene RLS habilitado', table_record.tablename;
      END IF;
    END IF;
  END LOOP;
  
  IF array_length(missing_rls, 1) IS NULL THEN
    RAISE NOTICE '✅ Todas las tablas críticas existentes tienen RLS';
  ELSE
    RAISE NOTICE '⚠️ % tablas sin RLS: %', array_length(missing_rls, 1), array_to_string(missing_rls, ', ');
  END IF;
END $$;

-- ========================================
-- VERIFICACIÓN FINAL
-- ========================================
DO $$
DECLARE
  total_policies int;
  total_tables_with_rls int;
BEGIN
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public';
  
  SELECT COUNT(*) INTO total_tables_with_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true;
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ Script 60 ejecutado correctamente';
  RAISE NOTICE '================================================';
  RAISE NOTICE '🔒 Total de políticas RLS activas: %', total_policies;
  RAISE NOTICE '📊 Tablas con RLS habilitado: %', total_tables_with_rls;
  RAISE NOTICE '';
  RAISE NOTICE '📋 RLS configurado/reforzado en:';
  RAISE NOTICE '   • notification_tokens (usuarios ven solo sus tokens)';
  RAISE NOTICE '   • user_settings (usuarios ven solo sus settings)';
  RAISE NOTICE '   • event_announcements (solo organizadores)';
  RAISE NOTICE '   • event_chats (solo asistentes pueden escribir)';
  RAISE NOTICE '   • external_attendance_batches (solo venue owners)';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Para verificar cobertura completa:';
  RAISE NOTICE '   SELECT * FROM check_rls_coverage();';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: Tablas inexistentes fueron saltadas automáticamente';
END $$;
