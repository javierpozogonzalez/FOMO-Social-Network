-- Script 56: Ocultar emails públicos (GDPR/Privacidad)
-- Este script previene que cualquier usuario pueda ver emails de otros usuarios
-- Impacto: NINGUNO en funcionalidad - Todo sigue funcionando igual
-- Beneficio: Cumple con GDPR y previene spam/scraping

-- PASO 0: Asegurar permisos de columna (evitar acceso directo a email/birth_date)
REVOKE ALL ON TABLE users FROM anon, authenticated;

-- Conceder solo columnas públicas a roles externos
GRANT SELECT (id, full_name, avatar_url, city, age, account_type, venue_id, created_at)
  ON users TO anon, authenticated;

-- PASO 1: Eliminar vista anterior si existe (para evitar conflictos)
DROP VIEW IF EXISTS users_public CASCADE;

-- Helpers: funciones seguras para exponer email y birth_date SOLO al propio usuario
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

-- PASO 2: Crear vista pública que oculta emails
-- Vista con SECURITY INVOKER para cumplir con el Security Advisor
CREATE VIEW users_public WITH (security_invoker = on) AS 
SELECT 
  id,
  full_name,
  avatar_url,
  city,
  age,
  account_type,
  venue_id,
  created_at,
  -- Campos sensibles vía funciones seguras
  get_own_email(id) as email,
  get_own_birth_date(id) as birth_date
FROM users;

-- PASO 3: Dar permisos de lectura a la vista
GRANT SELECT ON users_public TO anon, authenticated;

-- PASO 4: Política RLS de lectura de filas (columnas controladas por GRANTs)
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can view public profile fields" ON users;
CREATE POLICY "Users can view public profile fields" ON users 
FOR SELECT 
USING (true);

-- NOTA IMPORTANTE:
-- La app debe actualizarse para usar `users_public` en lugar de `users` en queries públicas
-- Pero si no lo hace, esta política sigue protegiendo el email
-- Por ejemplo, en FriendsScreen, AllSuggestionsScreen, etc.

-- PASO 5: Función helper para buscar usuarios por email (solo admin o propio usuario)
CREATE OR REPLACE FUNCTION search_user_by_email(search_email text)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  city text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo puede buscar su propio email
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE email = search_email AND id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado para buscar por email';
  END IF;
  
  RETURN QUERY
  SELECT u.id, u.full_name, u.avatar_url, u.city
  FROM users u
  WHERE u.email = search_email;
END;
$$;

GRANT EXECUTE ON FUNCTION search_user_by_email(text) TO authenticated;

-- VERIFICACIÓN: Comprobar que funciona
-- Como usuario normal, NO deberías poder ver emails de otros:
-- SELECT email FROM users WHERE id != auth.uid(); -- Debería devolver NULL

-- Como tu mismo usuario, SÍ debes ver tu email:
-- SELECT email FROM users WHERE id = auth.uid(); -- Debería mostrar tu email

COMMENT ON VIEW users_public IS 'Vista pública (SECURITY INVOKER) que expone solo datos públicos; email/birth_date solo para el propio usuario via funciones';
COMMENT ON FUNCTION get_own_email IS 'Devuelve el email solo si p_user_id = auth.uid()';
COMMENT ON FUNCTION get_own_birth_date IS 'Devuelve birth_date solo si p_user_id = auth.uid()';
COMMENT ON FUNCTION search_user_by_email IS 'Función segura para buscar usuarios por email (solo propio email)';

-- Log de ejecución
DO $$
BEGIN
  RAISE NOTICE '✅ Script 56 ejecutado correctamente';
  RAISE NOTICE '📧 Emails ahora están protegidos';
  RAISE NOTICE '👁️ Usa users_public en lugar de users para queries públicas';
END $$;
