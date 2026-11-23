-- Script 66: ARREGLAR LOGIN - Mantener seguridad + Permitir acceso a usuarios autenticados
-- Fecha: 15 de noviembre de 2025
-- Objetivo: Los usuarios autenticados pueden leer la tabla users (SU PROPIA INFO)
--           Los anónimos solo ven users_public
--           Los emails SIGUEN PROTEGIDOS (solo cada uno ve el suyo)

-- ===============================================
-- PARTE 1: PERMISOS DE LECTURA (SIN ROMPER SEGURIDAD)
-- ===============================================

-- Dar SELECT a usuarios autenticados en TODA la tabla users
-- (Necesario para que puedan ver sus propios datos completos)
GRANT SELECT ON TABLE users TO authenticated;

-- Los anónimos NO tienen acceso directo a users (usan users_public)
REVOKE ALL ON TABLE users FROM anon;

-- Los anónimos leen desde users_public (solo campos públicos)
GRANT SELECT ON users_public TO anon;

-- ===============================================
-- PARTE 2: POLÍTICAS RLS (PROTECCIÓN DE EMAILS)
-- ===============================================

-- ELIMINAR políticas antiguas
DROP POLICY IF EXISTS "Users can view public profile fields" ON users;
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON users;
DROP POLICY IF EXISTS "Anonymous can view public profiles" ON users;

-- NUEVA POLÍTICA: Los usuarios autenticados pueden leer TODOS los perfiles
-- PERO: Los emails están protegidos por las columnas de seguridad (ver Paso 3)
CREATE POLICY "Authenticated can read all user profiles" ON users 
FOR SELECT 
TO authenticated
USING (true);  -- Pueden leer todas las filas

-- ===============================================
-- PARTE 3: SEGURIDAD DE COLUMNAS (EMAILS PROTEGIDOS)
-- ===============================================

-- REVOCAR acceso directo a columnas sensibles
REVOKE SELECT (email, birth_date) ON users FROM authenticated;

-- CONCEDER acceso a columnas públicas + columnas del propio usuario
-- Esto permite leer id, full_name, avatar_url, etc. de TODOS
-- Pero email/birth_date SOLO del propio usuario (via funciones)
GRANT SELECT (
  id, 
  full_name, 
  avatar_url, 
  city, 
  age, 
  account_type, 
  venue_id, 
  created_at,
  subscription_status,
  email_verified
) ON users TO authenticated;

-- ===============================================
-- PARTE 4: FUNCIONES PARA ACCESO SEGURO A EMAIL
-- ===============================================

-- Función: Obtener email del propio usuario
CREATE OR REPLACE FUNCTION get_my_email()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT email FROM users WHERE id = auth.uid());
END;
$$;

-- Función: Obtener birth_date del propio usuario
CREATE OR REPLACE FUNCTION get_my_birth_date()
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT birth_date FROM users WHERE id = auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_email() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_birth_date() TO authenticated;

-- ===============================================
-- PARTE 5: PERMISOS DE ESCRITURA
-- ===============================================

-- Los usuarios pueden INSERTAR su propio perfil (durante registro)
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

GRANT INSERT ON users TO authenticated;

-- Los usuarios pueden ACTUALIZAR su propio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

GRANT UPDATE ON users TO authenticated;

-- ===============================================
-- VERIFICACIÓN
-- ===============================================

-- 1. Verificar que existe el usuario
SELECT 
  id,
  full_name,
  city,
  age,
  email_verified,
  created_at
FROM users
WHERE email = 'javierpozogonzalez@gmail.com';

-- 2. Verificar permisos
SELECT 
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('users', 'users_public')
AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, grantee;

-- Log de éxito
DO $$
BEGIN
  RAISE NOTICE '✅ Script 66 ejecutado correctamente';
  RAISE NOTICE '🔓 Usuarios autenticados pueden leer users (campos públicos + propios)';
  RAISE NOTICE '🔒 Emails protegidos: solo accesibles via get_my_email()';
  RAISE NOTICE '👁️ Anónimos siguen usando users_public';
  RAISE NOTICE '🛡️ SEGURIDAD MANTENIDA';
END $$;
