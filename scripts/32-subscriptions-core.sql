-- 32-subscriptions-core.sql
-- Núcleo de suscripciones/planes para venues
-- Idempotente: usa ALTER ... IF NOT EXISTS y CREATE OR REPLACE

-- 1) Columnas necesarias en users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Checks idempotentes para valores válidos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_type_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_account_type_check
      CHECK (account_type IS NULL OR account_type IN ('personal','venue_free','venue_pro','venue_premium','venue'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_subscription_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_subscription_status_check
      CHECK (subscription_status IS NULL OR subscription_status IN ('inactive','trial','trialing','on_trial','free_trial','active','past_due','canceled'));
  END IF;
END $$;

-- 2) Función: plan efectivo de un usuario local
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
  -- Evitar ambigüedad entre columnas y OUT params usando alias
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

  is_venue := (COALESCE(u.account_type,'') like 'venue%') OR u.venue_id IS NOT NULL;

  -- Mapear a plan conocido
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

  -- Si el plan base es premium, no degradar por estar en trial
  visual_plan := CASE 
    WHEN plan = 'premium' THEN 'premium'
    WHEN trial THEN 'pro'
    ELSE plan 
  END;
  RETURN;
END $$;

-- 3) RPC: ¿puede usar deduplicación?
CREATE OR REPLACE FUNCTION public.can_use_dedup(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (visual_plan = 'premium')
  FROM public.get_effective_venue_plan(p_user_id)
$$;

-- 4) RPC: ¿puede añadir lotes externos?
CREATE OR REPLACE FUNCTION public.can_add_external_batch(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (visual_plan IN ('pro','premium'))
  FROM public.get_effective_venue_plan(p_user_id)
$$;

-- 4.1) Versiones sin parámetros (auto) usando auth.uid()
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

CREATE OR REPLACE FUNCTION public.can_use_dedup_self()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.can_use_dedup(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_add_external_batch_self()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.can_add_external_batch(auth.uid());
$$;

-- 5) Trigger: al aprobar venue, asignar trial si no hay plan
CREATE OR REPLACE FUNCTION public.ensure_venue_trial_on_approval()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.users u
      SET venue_id = COALESCE(u.venue_id, NEW.id),
          account_type = CASE 
            WHEN u.account_type IS NULL OR u.account_type = 'personal' THEN 'venue_pro'
            ELSE u.account_type END,
          subscription_status = COALESCE(u.subscription_status, 'trial'),
          trial_ends_at = COALESCE(u.trial_ends_at, now() + interval '30 days')
    WHERE u.id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_venue_approval_trial ON public.venue_applications;
CREATE TRIGGER trg_venue_approval_trial
AFTER UPDATE ON public.venue_applications
FOR EACH ROW EXECUTE FUNCTION public.ensure_venue_trial_on_approval();

-- 6) Backfill para venues existentes sin plan definido
UPDATE public.users u
SET account_type = COALESCE(u.account_type, 'venue_pro'),
    subscription_status = COALESCE(u.subscription_status, 'trial'),
    trial_ends_at = COALESCE(u.trial_ends_at, now() + interval '30 days')
WHERE u.venue_id IS NOT NULL
  AND (u.account_type IS NULL OR u.account_type NOT LIKE 'venue_%');

-- 7) RPC para que el propio usuario actualice su plan (útil tras checkout)
CREATE OR REPLACE FUNCTION public.set_venue_plan_for_self(p_plan text, p_status text DEFAULT 'active', p_trial_days int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := auth.uid();
  plan_norm text := lower(p_plan);
  status_norm text := lower(p_status);
  atype text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Auth requerida';
  END IF;

  IF plan_norm NOT IN ('free','pro','premium') THEN
    RAISE EXCEPTION 'Plan inválido: %', p_plan;
  END IF;

  IF status_norm NOT IN ('trial','active','inactive','canceled','past_due') THEN
    status_norm := 'active';
  END IF;

  atype := CASE plan_norm
    WHEN 'free' THEN 'venue_free'
    WHEN 'pro' THEN 'venue_pro'
    WHEN 'premium' THEN 'venue_premium'
  END;

  UPDATE public.users
  SET account_type = atype,
      subscription_status = status_norm,
      trial_ends_at = CASE WHEN status_norm IN ('trial','trialing','on_trial','free_trial')
                           THEN now() + make_interval(days => COALESCE(p_trial_days, 30))
                           ELSE NULL END
  WHERE id = uid;
END $$;

-- 8) Conteo y límites de creación de eventos por mes
CREATE OR REPLACE FUNCTION public.get_event_limit_from_visual_plan(p_visual_plan text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(p_visual_plan)
    WHEN 'free' THEN 4
    WHEN 'pro' THEN 10
    WHEN 'premium' THEN NULL
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.count_venue_events_current_month(p_user_id uuid)
RETURNS int LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_id uuid;
  c int := 0;
  start_month date := date_trunc('month', now())::date;
  next_month  date := (date_trunc('month', now()) + interval '1 month')::date;
BEGIN
  SELECT venue_id INTO v_id FROM public.users WHERE id = p_user_id;
  IF v_id IS NULL THEN
    RETURN 0;
  END IF;
  SELECT count(*) INTO c
  FROM public.events e
  WHERE e.venue_id = v_id
    AND e.event_date >= start_month
    AND e.event_date < next_month;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.can_create_event(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  info record;
  limit_ int;
  used int;
BEGIN
  SELECT * INTO info FROM public.get_effective_venue_plan(p_user_id);
  IF NOT info.is_venue THEN
    RETURN false;
  END IF;
  limit_ := public.get_event_limit_from_visual_plan(info.visual_plan);
  IF limit_ IS NULL THEN
    RETURN true; -- premium = ilimitado
  END IF;
  used := public.count_venue_events_current_month(p_user_id);
  RETURN used < limit_;
END $$;

CREATE OR REPLACE FUNCTION public.can_create_event_self()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.can_create_event(auth.uid());
$$;
