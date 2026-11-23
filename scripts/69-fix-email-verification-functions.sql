-- Script 69: Arreglo definitivo funciones de verificación de email
-- Fecha: 16-11-2025
-- Objetivo: evitar problemas de search_path en funciones SECURITY DEFINER
-- Acción: recrear generate_verification_code y verify_email_code con SET search_path = public

BEGIN;

-- Asegurar existencia de tablas y columnas básicas (no destruye nada)
ALTER TABLE IF EXISTS public.users 
  ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, code)
);

-- Función: generar código (con search_path fijo)
CREATE OR REPLACE FUNCTION public.generate_verification_code(p_user_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  UPDATE public.email_verification_codes
  SET verified = true
  WHERE user_id = p_user_id AND verified = false;

  INSERT INTO public.email_verification_codes (user_id, email, code)
  VALUES (p_user_id, p_email, v_code);

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_verification_code(uuid, text) TO authenticated;

-- Función: verificar código (con search_path fijo)
CREATE OR REPLACE FUNCTION public.verify_email_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_valid boolean;
BEGIN
  v_user_id := auth.uid();

  SELECT id IS NOT NULL AND NOT verified AND expires_at > now()
  INTO v_valid
  FROM public.email_verification_codes
  WHERE user_id = v_user_id AND code = p_code
  LIMIT 1;

  IF v_valid THEN
    UPDATE public.email_verification_codes
    SET verified = true
    WHERE user_id = v_user_id AND code = p_code;

    UPDATE public.users
    SET email_verified = true
    WHERE id = v_user_id;

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_email_code(text) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Funciones de verificación recreadas con SET search_path = public';
END $$;

COMMIT;