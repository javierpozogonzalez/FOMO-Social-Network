-- 47-fix-venue-plan-and-announcement-limits.sql
-- Arregla ambigüedad de account_type en funciones de plan y asegura límites correctos de anuncios
-- Ejecuta este script en Supabase SQL Editor (Producción)

BEGIN;

-- 1) Eliminar posibles versiones antiguas para evitar ambigüedad
DROP FUNCTION IF EXISTS public.get_effective_venue_plan(uuid);
DROP FUNCTION IF EXISTS public.get_effective_venue_plan_self();
DROP FUNCTION IF EXISTS public.can_use_dedup(uuid);
DROP FUNCTION IF EXISTS public.can_add_external_batch(uuid);

-- 2) Función base: plan efectivo del venue (PL/pgSQL, sin ambigüedad)
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
  -- Usar alias para evitar ambigüedad con OUT params
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

  -- Mapear plan base desde account_type
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

  -- Premium no se degrada por trial; en trial de otros planes, usar pro como visual
  visual_plan := CASE 
    WHEN plan = 'premium' THEN 'premium'
    WHEN trial THEN 'pro'
    ELSE plan 
  END;
  RETURN;
END $$;

-- 3) Helper auto (auth.uid())
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

-- 4) Límite de anuncios por plan (premium = ilimitado => retorna NULL)
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
    WHEN 'premium' THEN NULL  -- ilimitado
    ELSE 0
  END;
END $$;

-- 5) (Opcional) Otros helpers antiguos recompilados sobre la nueva base
CREATE OR REPLACE FUNCTION public.can_use_dedup(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (visual_plan = 'premium')
  FROM public.get_effective_venue_plan(p_user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_add_external_batch(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (visual_plan IN ('pro','premium'))
  FROM public.get_effective_venue_plan(p_user_id)
$$;

COMMIT;

-- Verificaciones (opcionales):
-- SELECT visual_plan FROM public.get_effective_venue_plan('<USER_ID>'::uuid);
-- SELECT public.get_announcement_limit_from_plan('<USER_ID>'::uuid) AS limite;
-- Si es premium debe devolver NULL en la segunda.
