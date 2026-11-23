-- 49-venue-plan-in-applications.sql
-- Migrar plan desde users.account_type a venue_applications.subscription_plan
-- El plan ahora vive en venue_applications y se sincroniza automáticamente a users

BEGIN;

-- ============================================================================
-- 1) AÑADIR COLUMNA PLAN A VENUE_APPLICATIONS
-- ============================================================================

ALTER TABLE public.venue_applications
  ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'free' 
    CHECK (subscription_plan IN ('free', 'pro', 'premium'));

ALTER TABLE public.venue_applications
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'trial', 'active', 'past_due', 'canceled'));

ALTER TABLE public.venue_applications
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Índice para búsquedas rápidas por plan
CREATE INDEX IF NOT EXISTS idx_venue_applications_plan 
  ON public.venue_applications(subscription_plan, subscription_status);

-- ============================================================================
-- 2) MIGRAR PLAN ACTUAL DE USERS A VENUE_APPLICATIONS
-- ============================================================================

-- Para venues ya aprobados, copiar el plan de users a venue_applications
UPDATE public.venue_applications va
SET subscription_plan = CASE 
    WHEN u.account_type = 'venue_premium' THEN 'premium'
    WHEN u.account_type = 'venue_pro' THEN 'pro'
    WHEN u.account_type = 'venue_free' THEN 'free'
    WHEN u.account_type = 'venue' THEN 'premium'  -- legacy
    ELSE 'free'
  END,
  subscription_status = COALESCE(u.subscription_status, 'active'),
  trial_ends_at = u.trial_ends_at
FROM public.users u
WHERE va.user_id = u.id
  AND va.status = 'approved'
  AND u.venue_id IS NOT NULL;

-- ============================================================================
-- 3) TRIGGER: SINCRONIZAR venue_applications.subscription_plan → users.account_type
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_venue_plan_to_user()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_account_type text;
BEGIN
  -- Solo sincronizar si el venue está aprobado
  IF NEW.status != 'approved' THEN
    RETURN NEW;
  END IF;

  -- Mapear plan a account_type
  new_account_type := CASE NEW.subscription_plan
    WHEN 'premium' THEN 'venue_premium'
    WHEN 'pro' THEN 'venue_pro'
    WHEN 'free' THEN 'venue_free'
    ELSE 'venue_free'
  END;

  -- Actualizar usuario
  UPDATE public.users
  SET account_type = new_account_type,
      subscription_status = NEW.subscription_status,
      trial_ends_at = NEW.trial_ends_at
  WHERE id = NEW.user_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_venue_plan_to_user ON public.venue_applications;
CREATE TRIGGER trg_sync_venue_plan_to_user
  AFTER INSERT OR UPDATE OF subscription_plan, subscription_status, trial_ends_at
  ON public.venue_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_venue_plan_to_user();

-- ============================================================================
-- 4) RPC: CAMBIAR PLAN (ahora escribe en venue_applications)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_venue_plan_for_self(
  p_plan text, 
  p_status text DEFAULT 'active', 
  p_trial_days int DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid uuid := auth.uid();
  plan_norm text := lower(p_plan);
  status_norm text := lower(p_status);
  v_app_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;

  -- Validar plan
  IF plan_norm NOT IN ('free','pro','premium') THEN
    RAISE EXCEPTION 'Plan inválido: %. Use free, pro o premium', p_plan;
  END IF;

  -- Validar status
  IF status_norm NOT IN ('trial','active','inactive','canceled','past_due') THEN
    status_norm := 'active';
  END IF;

  -- Buscar venue_application aprobado del usuario
  SELECT id INTO v_app_id
  FROM public.venue_applications
  WHERE user_id = uid AND status = 'approved'
  LIMIT 1;

  IF v_app_id IS NULL THEN
    RAISE EXCEPTION 'No tienes un venue aprobado. Solo venues pueden cambiar de plan.';
  END IF;

  -- Actualizar plan en venue_applications (el trigger sincronizará a users automáticamente)
  UPDATE public.venue_applications
  SET subscription_plan = plan_norm,
      subscription_status = status_norm,
      trial_ends_at = CASE 
        WHEN status_norm IN ('trial','trialing','on_trial','free_trial')
        THEN now() + make_interval(days => COALESCE(p_trial_days, 30))
        ELSE NULL 
      END,
      updated_at = now()
  WHERE id = v_app_id;

END $$;

-- ============================================================================
-- 5) ACTUALIZAR get_effective_venue_plan PARA LEER DE venue_applications
-- ============================================================================

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
  va record;
  p text;
  v_subscription_status text;
  v_trial_ends_at timestamptz;
  trial bool;
BEGIN
  -- Leer usuario
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
    RETURN NEXT;  -- ⭐ ARREGLADO: Usar RETURN NEXT antes de RETURN
    RETURN;
  END IF;

  venue_id := u.venue_id;
  is_venue := (COALESCE(u.account_type,'') LIKE 'venue%') OR u.venue_id IS NOT NULL;

  -- Si es venue, leer plan de venue_applications (fuente de verdad)
  IF is_venue AND u.venue_id IS NOT NULL THEN
    SELECT va2.subscription_plan, va2.subscription_status, va2.trial_ends_at
    INTO va
    FROM public.venue_applications va2
    WHERE va2.id = u.venue_id AND va2.status = 'approved'
    LIMIT 1;

    IF FOUND THEN
      p := va.subscription_plan;
      v_subscription_status := va.subscription_status;
      v_trial_ends_at := va.trial_ends_at;
      account_type := CASE p
        WHEN 'premium' THEN 'venue_premium'
        WHEN 'pro' THEN 'venue_pro'
        WHEN 'free' THEN 'venue_free'
        ELSE 'venue_free'
      END;
    ELSE
      -- Fallback a users.account_type si no hay venue_application
      account_type := u.account_type;
      v_subscription_status := u.subscription_status;
      v_trial_ends_at := u.trial_ends_at;
      
      IF u.account_type = 'venue_premium' THEN p := 'premium';
      ELSIF u.account_type = 'venue_pro' THEN p := 'pro';
      ELSIF u.account_type = 'venue_free' THEN p := 'free';
      ELSIF u.account_type = 'venue' THEN p := 'premium';
      ELSE p := 'free'; END IF;
    END IF;
  ELSE
    -- No es venue, leer de users
    account_type := u.account_type;
    v_subscription_status := u.subscription_status;
    v_trial_ends_at := u.trial_ends_at;
    p := NULL;
  END IF;

  plan := p;
  subscription_status := v_subscription_status;
  trial_ends_at := v_trial_ends_at;

  trial := (COALESCE(lower(v_subscription_status),'') IN ('trial','trialing','on_trial','free_trial'))
           AND (v_trial_ends_at IS NOT NULL AND v_trial_ends_at > now());
  trial_active := trial;

  -- Premium nunca se degrada
  visual_plan := CASE 
    WHEN plan = 'premium' THEN 'premium'
    WHEN trial THEN 'pro'
    ELSE plan 
  END;
  
  RETURN NEXT;  -- ⭐ ARREGLADO: Usar RETURN NEXT para funciones RETURNS TABLE
  RETURN;
END $$;

-- ============================================================================
-- 6) ACTUALIZAR get_announcement_limit_from_plan PARA LEER PLAN CORRECTAMENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_announcement_limit_from_plan(p_user_id uuid)
RETURNS int LANGUAGE plpgsql STABLE AS $$
DECLARE
  plan_info record;
BEGIN
  -- Obtener plan efectivo completo
  SELECT * INTO plan_info 
  FROM public.get_effective_venue_plan(p_user_id)
  LIMIT 1;
  
  -- Si no es venue o no tiene plan, límite 0
  IF NOT FOUND OR NOT plan_info.is_venue OR plan_info.visual_plan IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Mapear plan a límite (premium = NULL = ilimitado)
  RETURN CASE lower(plan_info.visual_plan)
    WHEN 'free' THEN 2
    WHEN 'pro' THEN 6
    WHEN 'premium' THEN NULL  -- ⭐ ILIMITADO
    ELSE 0
  END;
END $$;

-- ============================================================================
-- 7) PONER TU VENUE EN PREMIUM (migración manual)
-- ============================================================================

-- Actualizar tu venue a Premium (el trigger sincronizará a users)
UPDATE public.venue_applications
SET subscription_plan = 'premium',
    subscription_status = 'active',
    trial_ends_at = NULL,
    updated_at = now()
WHERE id = 'b0a75185-d9f4-49fa-abad-9b1047323db1';

COMMIT;

-- ============================================================================
-- ✅ VERIFICACIONES (ejecuta después del script)
-- ============================================================================

-- 1. Verificar plan en venue_applications:
-- SELECT subscription_plan, subscription_status FROM venue_applications WHERE id = 'b0a75185-d9f4-49fa-abad-9b1047323db1';
-- Debe mostrar: premium | active

-- 2. Verificar sincronización a users:
-- SELECT account_type, subscription_status FROM users WHERE id = 'e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae';
-- Debe mostrar: venue_premium | active

-- 3. Verificar plan efectivo:
-- SELECT visual_plan FROM get_effective_venue_plan('e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae');
-- Debe mostrar: premium

-- 4. Verificar límite de anuncios (DEBE SER NULL = ILIMITADO):
-- SELECT get_announcement_limit_from_plan('e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae');
-- Debe mostrar: NULL (vacío)

-- ============================================================================
-- 💡 CÓMO FUNCIONA AHORA
-- ============================================================================
-- 1. App cambia plan → UPDATE venue_applications.subscription_plan = 'premium'
-- 2. Trigger automático → UPDATE users.account_type = 'venue_premium'
-- 3. get_effective_venue_plan lee de venue_applications (fuente de verdad)
-- 4. Todas las funciones (dedup, límites) leen users.account_type (cache sincronizado)
-- 5. Realtime en venue_applications notifica cambios a la app
