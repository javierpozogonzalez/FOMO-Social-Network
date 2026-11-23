-- 55-stripe-billing.sql
-- Integración de Stripe para facturación de venues

BEGIN;

-- ============================================================================
-- 1) AÑADIR COLUMNAS STRIPE A venue_applications
-- ============================================================================

ALTER TABLE public.venue_applications
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS billing_tax_id text;  -- CIF/NIF para facturación

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_venue_apps_stripe_customer 
  ON public.venue_applications(stripe_customer_id);
  
CREATE INDEX IF NOT EXISTS idx_venue_apps_stripe_subscription 
  ON public.venue_applications(stripe_subscription_id);

-- ============================================================================
-- 2) FUNCIÓN HELPER: Obtener Stripe Customer ID (crear si no existe)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_stripe_customer(
  p_venue_app_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id text;
  v_email text;
  v_venue_name text;
BEGIN
  -- Buscar customer existente
  SELECT stripe_customer_id, billing_email, venue_name
  INTO v_customer_id, v_email, v_venue_name
  FROM public.venue_applications
  WHERE id = p_venue_app_id;
  
  -- Si ya existe, devolverlo
  IF v_customer_id IS NOT NULL THEN
    RETURN v_customer_id;
  END IF;
  
  -- Si no, la Edge Function lo creará y guardará aquí
  -- Esta función solo devuelve el existente o NULL
  RETURN NULL;
END $$;

-- ============================================================================
-- 3) FUNCIÓN: Actualizar info de Stripe (llamada desde webhook)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_stripe_subscription(
  p_venue_app_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_subscription_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan text;
BEGIN
  -- Mapear price_id a plan (debes ajustar según tus IDs reales de Stripe)
  -- Ejemplo: price_1ABC...free → 'free', price_1XYZ...premium → 'premium'
  v_plan := CASE
    WHEN p_stripe_price_id LIKE '%free%' THEN 'free'
    WHEN p_stripe_price_id LIKE '%pro%' THEN 'pro'
    WHEN p_stripe_price_id LIKE '%premium%' THEN 'premium'
    ELSE 'free'
  END;
  
  -- Actualizar venue_applications
  UPDATE public.venue_applications
  SET 
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id,
    stripe_price_id = p_stripe_price_id,
    subscription_plan = v_plan,
    subscription_status = CASE p_subscription_status
      WHEN 'active' THEN 'active'
      WHEN 'trialing' THEN 'trial'
      WHEN 'past_due' THEN 'past_due'
      WHEN 'canceled' THEN 'canceled'
      WHEN 'unpaid' THEN 'past_due'
      ELSE 'inactive'
    END,
    current_period_end = p_current_period_end,
    cancel_at_period_end = p_cancel_at_period_end,
    updated_at = now()
  WHERE id = p_venue_app_id;
  
  -- Registrar en audit logs
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, metadata)
  VALUES (
    (SELECT user_id FROM public.venue_applications WHERE id = p_venue_app_id),
    'stripe_subscription_update',
    'venue_applications',
    p_venue_app_id,
    jsonb_build_object(
      'subscription_id', p_stripe_subscription_id,
      'plan', v_plan,
      'status', p_subscription_status
    )
  );
END $$;

-- ============================================================================
-- 4) POLÍTICA RLS: Solo el venue puede ver su info de billing
-- ============================================================================

-- Las columnas Stripe son sensibles, asegurar que solo el owner las ve
-- (Ya deberías tener RLS activo en venue_applications, esto es un recordatorio)

COMMIT;

-- ============================================================================
-- ✅ SIGUIENTE PASO
-- ============================================================================
-- 1. Ejecuta este script en Supabase SQL Editor
-- 2. Ve a Stripe Dashboard → Productos → Crea 3 productos:
--    - FOMO Free (0€/mes o sin precio)
--    - FOMO Pro (19€/mes)
--    - FOMO Premium (99€/mes)
-- 3. Copia los Price IDs (price_xxx) para usarlos en las Edge Functions
-- 4. Configura los secrets en Supabase:
--    - STRIPE_SECRET_KEY (de Stripe Dashboard → Developers → API Keys)
--    - STRIPE_WEBHOOK_SECRET (lo obtendrás al crear el webhook endpoint)
