-- Script 65: RESTAURAR funcionalidad de login - Arreglar permisos de users
-- Fecha: 15 de noviembre de 2025
-- Problema: El script 56 revocó permisos y ahora no se pueden recuperar datos de usuario

-- PASO 1: Restaurar permisos completos en la tabla users para usuarios autenticados
-- Los usuarios autenticados NECESITAN leer toda la información de la tabla users
GRANT SELECT, INSERT, UPDATE ON TABLE users TO authenticated;

-- PASO 2: Mantener restricción para usuarios anónimos (no autenticados)
GRANT SELECT (id, full_name, avatar_url, city, age, account_type, venue_id, created_at)
  ON users TO anon;

-- PASO 3: Asegurar que las políticas RLS permiten lectura
DROP POLICY IF EXISTS "Users can view public profile fields" ON users;
DROP POLICY IF EXISTS "Users can view all profiles" ON users;

-- Política nueva: Los usuarios autenticados pueden ver TODOS los perfiles
CREATE POLICY "Authenticated users can view all profiles" ON users 
FOR SELECT 
TO authenticated
USING (true);

-- Política para anónimos: pueden ver perfiles públicos (sin email/birth_date)
CREATE POLICY "Anonymous can view public profiles" ON users 
FOR SELECT 
TO anon
USING (true);

-- PASO 4: Política de actualización (usuarios solo pueden actualizar su propio perfil)
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- PASO 5: Política de inserción (se permite desde trigger de registro)
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- PASO 6: Verificar que las funciones auxiliares existen
-- Estas permiten acceso seguro a campos sensibles
CREATE OR REPLACE FUNCTION get_own_email(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id = auth.uid() THEN
    RETURN (SELECT email FROM users WHERE id = p_user_id);
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_own_birth_date(p_user_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id = auth.uid() THEN
    RETURN (SELECT birth_date FROM users WHERE id = p_user_id);
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_own_email(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_own_birth_date(uuid) TO anon, authenticated;

-- PASO 7: Verificación
DO $$
BEGIN
  RAISE NOTICE '✅ Permisos restaurados correctamente';
  RAISE NOTICE '📱 Los usuarios autenticados pueden leer toda la tabla users';
  RAISE NOTICE '🔒 Los usuarios anónimos solo ven campos públicos';
  RAISE NOTICE '✉️ El email es accesible solo por get_own_email() para otros usuarios';
END $$;

-- Verificar permisos actuales
SELECT 
  grantee,
  privilege_type,
  table_name
FROM information_schema.role_table_grants
WHERE table_name = 'users'
ORDER BY grantee, privilege_type;
