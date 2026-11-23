-- Script para permitir el estado 'free' en subscription_status
-- Ejecutar en SQL Editor de Supabase

-- Actualizar la RPC set_venue_plan_for_self para manejar correctamente el plan FREE
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

  -- Permitir 'free' como estado válido para el plan FREE
  IF status_norm NOT IN ('trial','active','inactive','canceled','past_due','free') THEN
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

COMMENT ON FUNCTION public.set_venue_plan_for_self IS 'Permite cambiar el plan del venue actual (incluyendo FREE para testing)';
