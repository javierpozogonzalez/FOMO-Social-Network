-- 48-fix-premium-user-and-announcements.sql
-- PASO 1: Poner tu usuario en Premium de verdad
-- PASO 2: Arreglar funciones de plan
-- PASO 3: Verificar que funciona

-- ============================================================================
-- PASO 1: ACTUALIZAR TU USUARIO A PREMIUM
-- ============================================================================
-- Cambia 'tu_email@example.com' por tu email real de la app
UPDATE public.users
SET account_type = 'venue_premium',
    subscription_status = 'active',
    trial_ends_at = NULL
WHERE email = 'javierpozog10@gmail.com';  -- 🔴 CAMBIA ESTO POR TU EMAIL

-- Verificar (deberías ver venue_premium):
-- SELECT id, email, account_type, subscription_status FROM public.users WHERE email = 'tu_email';

-- ============================================================================
-- PASO 2: RECREAR FUNCIONES SIN AMBIGÜEDAD
-- ============================================================================

-- 2.1) Función base de plan (con alias u2 para evitar ambigüedad)
CREATE OR REPLACE FUNCTION public.get_effective_venue_plan(p_user_id uuid)
RETURNS TABLE (
  is_venue boolean,
  venue_id uuid,
  account_type text,
  plan text,
  subscription_status text,
  trial_ends_at timestamptz,
  trial_active boolean,
  visual_plan text
) LANGUAGE plpgsql AS $$
DECLARE
  u record;
  p text;
  trial bool;
BEGIN
  -- Usar alias u2 para evitar conflicto con OUT param account_type
  SELECT u2.id, u2.account_type, u2.subscription_status, u2.trial_ends_at, u2.venue_id
  INTO u
  FROM public.users u2
  WHERE u2.id = p_user_id;

  IF NOT FOUND THEN
    is_venue := false;
    venue_id := NULL;
    account_type := NULL;
    plan := NULL;
    subscription_status := NULL;
    trial_ends_at := NULL;
    trial_active := false;
    visual_plan := NULL;
    RETURN;
  END IF;

  account_type := u.account_type;
  subscription_status := u.subscription_status;
  trial_ends_at := u.trial_ends_at;
  venue_id := u.venue_id;

  is_venue := (COALESCE(u.account_type,'') LIKE 'venue%') OR u.venue_id IS NOT NULL;

  -- Mapear plan base
  IF u.account_type = 'venue_premium' THEN p := 'premium';
  ELSIF u.account_type = 'venue_pro' THEN p := 'pro';
  ELSIF u.account_type = 'venue_free' THEN p := 'free';
  ELSIF u.account_type = 'venue' THEN p := 'premium'; -- legacy
  ELSIF is_venue THEN p := 'free';
  ELSE p := NULL; END IF;

  plan := p;

  trial := (COALESCE(lower(subscription_status),'') IN ('trial','trialing','on_trial','free_trial'))
           AND (trial_ends_at IS NOT NULL AND trial_ends_at > now());
  trial_active := trial;

  -- Premium NUNCA se degrada (ni en trial)
  visual_plan := CASE 
    WHEN plan = 'premium' THEN 'premium'
    WHEN trial THEN 'pro'
    ELSE plan 
  END;
  
  RETURN;
END $$;

-- 2.2) Límite de anuncios (premium = NULL = ilimitado)
CREATE OR REPLACE FUNCTION public.get_announcement_limit_from_plan(p_user_id uuid)
RETURNS int LANGUAGE plpgsql STABLE AS $$
DECLARE
  plan_name text;
BEGIN
  SELECT visual_plan INTO plan_name 
  FROM public.get_effective_venue_plan(p_user_id);
  
  RETURN CASE lower(COALESCE(plan_name, ''))
    WHEN 'free' THEN 2
    WHEN 'pro' THEN 6
    WHEN 'premium' THEN NULL  -- ⭐ ILIMITADO
    ELSE 0
  END;
END $$;

-- 2.3) Helper self
CREATE OR REPLACE FUNCTION public.get_effective_venue_plan_self()
RETURNS TABLE (
  is_venue boolean,
  venue_id uuid,
  account_type text,
  plan text,
  subscription_status text,
  trial_ends_at timestamptz,
  trial_active boolean,
  visual_plan text
) LANGUAGE sql STABLE AS $$
  SELECT * FROM public.get_effective_venue_plan(auth.uid());
$$;

-- ============================================================================
-- PASO 3: VERIFICAR QUE FUNCIONA
-- ============================================================================

-- Test 1: Ver tu plan efectivo (debe decir 'premium'):
-- SELECT visual_plan FROM public.get_effective_venue_plan('<TU_USER_ID>');

-- Test 2: Ver límite de anuncios (debe ser NULL):
-- SELECT public.get_announcement_limit_from_plan('<TU_USER_ID>');

-- Test 3: Contar anuncios en tu evento (debe ser 0 ahora):
-- SELECT count(*) FROM public.event_announcements WHERE event_id = '<TU_EVENT_ID>';

-- ============================================================================
-- 💡 INSTRUCCIONES
-- ============================================================================
-- 1. Abre Supabase → SQL Editor
-- 2. Cambia 'javierpozogonzalez@icloud.com' por tu email real (línea 11)
-- 3. Ejecuta TODO el script
-- 4. Verifica en Table Editor → users → busca tu email → account_type debe ser 'venue_premium'
-- 5. Prueba crear anuncio en la app
-- 6. Ve a Table Editor → event_announcements → debe aparecer tu anuncio
