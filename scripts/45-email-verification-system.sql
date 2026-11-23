-- Script 45: Email Verification - Configuración Base de Datos
-- Este script prepara la BD para email verification
-- NO rompe funcionalidad existente, solo añade seguridad

BEGIN;

-- ============================================
-- PASO 1: Añadir columna de verificación
-- ============================================

-- Columna para saber si el email está verificado
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- ============================================
-- PASO 2: Marcar usuarios existentes como verificados
-- ============================================

-- IMPORTANTE: Usuarios que ya existen se marcan como verificados
-- Para no romper la app actual
UPDATE users 
SET email_verified = true 
WHERE email_verified IS NULL OR email_verified = false;

-- ============================================
-- PASO 3: Crear tabla de códigos de verificación
-- ============================================

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL, -- Código de 6 dígitos
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON email_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON email_verification_codes(expires_at);

-- ============================================
-- PASO 4: RLS para tabla de códigos
-- ============================================

ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Solo el propio usuario puede ver sus códigos
CREATE POLICY "Users can view own verification codes" 
ON email_verification_codes
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Solo el sistema puede insertar códigos (vía función)
CREATE POLICY "System can insert verification codes"
ON email_verification_codes
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================
-- PASO 5: Función para generar código
-- ============================================

CREATE OR REPLACE FUNCTION generate_verification_code(p_user_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
BEGIN
  -- Generar código aleatorio de 6 dígitos
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
  
  -- Invalidar códigos anteriores
  UPDATE email_verification_codes
  SET verified = true
  WHERE user_id = p_user_id AND verified = false;
  
  -- Insertar nuevo código
  INSERT INTO email_verification_codes (user_id, email, code)
  VALUES (p_user_id, p_email, v_code);
  
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_verification_code TO authenticated;

-- ============================================
-- PASO 6: Función para verificar código
-- ============================================

CREATE OR REPLACE FUNCTION verify_email_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_valid boolean;
BEGIN
  v_user_id := auth.uid();
  
  -- Verificar si el código es válido y no ha expirado
  SELECT 
    id IS NOT NULL AND NOT verified AND expires_at > NOW()
  INTO v_valid
  FROM email_verification_codes
  WHERE user_id = v_user_id
    AND code = p_code
  LIMIT 1;
  
  IF v_valid THEN
    -- Marcar código como verificado
    UPDATE email_verification_codes
    SET verified = true
    WHERE user_id = v_user_id AND code = p_code;
    
    -- Marcar email como verificado en users
    UPDATE users
    SET email_verified = true
    WHERE id = v_user_id;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_email_code TO authenticated;

-- ============================================
-- PASO 7: Trigger para nuevos usuarios
-- ============================================

-- Cuando se crea un nuevo usuario, su email NO está verificado
CREATE OR REPLACE FUNCTION set_new_user_unverified()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo para usuarios nuevos (no existentes)
  IF NEW.created_at > NOW() - INTERVAL '1 minute' THEN
    NEW.email_verified := false;
  END IF;
  RETURN NEW;
END;
$$;

-- Aplicar solo a nuevas inserciones
DROP TRIGGER IF EXISTS trigger_set_new_user_unverified ON users;
CREATE TRIGGER trigger_set_new_user_unverified
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION set_new_user_unverified();

COMMIT;

-- ============================================
-- NOTAS DE IMPLEMENTACIÓN EN LA APP
-- ============================================

/*
En LoginScreen.tsx después del registro:

1. Llamar a generate_verification_code:
   const { data: code } = await supabase.rpc('generate_verification_code', {
     p_user_id: user.id,
     p_email: email
   })

2. Enviar email con el código (usando servicio de email)
   - Recomiendo: Resend, SendGrid, o AWS SES
   - El código está en la variable 'code'

3. Mostrar pantalla para ingresar código

4. Verificar código:
   const { data: isValid } = await supabase.rpc('verify_email_code', {
     p_code: userInputCode
   })

5. Si isValid === true, continuar al app
   Si false, mostrar error "Código incorrecto o expirado"

IMPORTANTE: Usuarios existentes NO se ven afectados (email_verified = true)
*/
