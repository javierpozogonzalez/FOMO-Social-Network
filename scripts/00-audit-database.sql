-- Script 00: Auditoría Completa de la Base de Datos
-- Ejecuta esto PRIMERO para ver qué tienes instalado
-- Copia TODO el output y pégalo en el chat para que pueda crear scripts compatibles

-- ========================================
-- 1. LISTAR TODAS LAS TABLAS
-- ========================================
DO $$
DECLARE
  table_count int;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '📊 AUDITORÍA DE BASE DE DATOS - TABLAS';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Total de tablas: %', table_count;
  RAISE NOTICE '';
END $$;

SELECT 
  tablename as "📋 Tabla",
  rowsecurity as "🔒 RLS"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ========================================
-- 2. COLUMNAS DE CADA TABLA CRÍTICA
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '📝 ESTRUCTURA DE TABLAS CRÍTICAS';
  RAISE NOTICE '================================================';
END $$;

-- Users
SELECT 
  'USERS' as "Tabla",
  column_name as "Columna",
  data_type as "Tipo",
  is_nullable as "Nullable"
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- Events
SELECT 
  'EVENTS' as "Tabla",
  column_name as "Columna",
  data_type as "Tipo",
  is_nullable as "Nullable"
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'events'
ORDER BY ordinal_position;

-- Venue Applications
SELECT 
  'VENUE_APPLICATIONS' as "Tabla",
  column_name as "Columna",
  data_type as "Tipo",
  is_nullable as "Nullable"
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'venue_applications'
ORDER BY ordinal_position;

-- Friendships
SELECT 
  'FRIENDSHIPS' as "Tabla",
  column_name as "Columna",
  data_type as "Tipo",
  is_nullable as "Nullable"
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'friendships'
ORDER BY ordinal_position;

-- ========================================
-- 3. VERIFICAR TABLAS NUEVAS DE SCRIPTS
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '🔍 VERIFICACIÓN DE TABLAS DE SEGURIDAD';
  RAISE NOTICE '================================================';
  
  -- Reports (Script 57)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reports') THEN
    RAISE NOTICE '✅ reports - EXISTE (Script 57)';
  ELSE
    RAISE NOTICE '❌ reports - NO EXISTE (Script 57 no ejecutado)';
  END IF;
  
  -- Rate Limit Tracking (Script 58)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rate_limit_tracking') THEN
    RAISE NOTICE '✅ rate_limit_tracking - EXISTE (Script 58)';
  ELSE
    RAISE NOTICE '❌ rate_limit_tracking - NO EXISTE (Script 58 no ejecutado)';
  END IF;
  
  -- Security Logs (Script 61)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'security_logs') THEN
    RAISE NOTICE '✅ security_logs - EXISTE (Script 61)';
  ELSE
    RAISE NOTICE '❌ security_logs - NO EXISTE (Script 61 no ejecutado)';
  END IF;
  
  -- Security Config (Script 61)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'security_config') THEN
    RAISE NOTICE '✅ security_config - EXISTE (Script 61)';
  ELSE
    RAISE NOTICE '❌ security_config - NO EXISTE (Script 61 no ejecutado)';
  END IF;
  
  -- Venue Usage (Script 24)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'venue_usage') THEN
    RAISE NOTICE '✅ venue_usage - EXISTE (Script 24)';
  ELSE
    RAISE NOTICE '❌ venue_usage - NO EXISTE (Script 24 no ejecutado)';
  END IF;
  
  -- Notification Tokens (Script 22)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_tokens') THEN
    RAISE NOTICE '✅ notification_tokens - EXISTE (Script 22)';
  ELSE
    RAISE NOTICE '❌ notification_tokens - NO EXISTE (Script 22 no ejecutado)';
  END IF;
END $$;

-- ========================================
-- 4. LISTAR TODAS LAS VISTAS
-- ========================================
DO $$
DECLARE
  view_count int;
BEGIN
  SELECT COUNT(*) INTO view_count
  FROM pg_views
  WHERE schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '👁️ VISTAS EXISTENTES';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Total de vistas: %', view_count;
END $$;

SELECT 
  viewname as "Vista"
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- Verificar vista users_public (Script 56)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'users_public') THEN
    RAISE NOTICE '✅ users_public - EXISTE (Script 56)';
  ELSE
    RAISE NOTICE '❌ users_public - NO EXISTE (Script 56 no ejecutado)';
  END IF;
END $$;

-- ========================================
-- 5. LISTAR TODAS LAS FUNCIONES RPC
-- ========================================
DO $$
DECLARE
  func_count int;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '⚙️ FUNCIONES RPC EXISTENTES';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Total de funciones: %', func_count;
END $$;

SELECT 
  p.proname as "Función",
  pg_get_function_arguments(p.oid) as "Argumentos"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
ORDER BY p.proname;

-- ========================================
-- 6. VERIFICAR POLÍTICAS RLS
-- ========================================
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '🔒 POLÍTICAS RLS ACTIVAS';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Total de políticas: %', policy_count;
END $$;

SELECT 
  tablename as "Tabla",
  policyname as "Política",
  cmd as "Comando"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ========================================
-- 7. STORAGE BUCKETS
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '🗄️ STORAGE BUCKETS';
  RAISE NOTICE '================================================';
END $$;

SELECT 
  name as "Bucket",
  public as "Público"
FROM storage.buckets
ORDER BY name;

-- ========================================
-- 8. RESUMEN FINAL
-- ========================================
DO $$
DECLARE
  total_tables int;
  total_views int;
  total_functions int;
  total_policies int;
  total_buckets int;
BEGIN
  SELECT COUNT(*) INTO total_tables FROM pg_tables WHERE schemaname = 'public';
  SELECT COUNT(*) INTO total_views FROM pg_views WHERE schemaname = 'public';
  SELECT COUNT(*) INTO total_functions FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';
  SELECT COUNT(*) INTO total_policies FROM pg_policies WHERE schemaname = 'public';
  SELECT COUNT(*) INTO total_buckets FROM storage.buckets;
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '📊 RESUMEN FINAL';
  RAISE NOTICE '================================================';
  RAISE NOTICE '📋 Tablas: %', total_tables;
  RAISE NOTICE '👁️ Vistas: %', total_views;
  RAISE NOTICE '⚙️ Funciones: %', total_functions;
  RAISE NOTICE '🔒 Políticas RLS: %', total_policies;
  RAISE NOTICE '🗄️ Buckets: %', total_buckets;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Auditoría completada';
  RAISE NOTICE '📋 Copia TODO este output y pégalo en el chat';
  RAISE NOTICE '   para que pueda crear scripts compatibles';
END $$;
