-- Extensión de la tabla users para cuentas profesionales
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'personal' CHECK (account_type IN ('personal', 'venue_free', 'venue_pro', 'venue_premium'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venue_applications(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'trial', 'active', 'past_due', 'canceled'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id TEXT; -- Stripe subscription ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Tabla para rastrear uso mensual (freemium limits)
CREATE TABLE IF NOT EXISTS venue_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL, -- 1-12
  year INTEGER NOT NULL,
  events_created INTEGER DEFAULT 0,
  events_featured INTEGER DEFAULT 0,
  notifications_sent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

-- Índices
CREATE INDEX idx_venue_usage_user_month ON venue_usage(user_id, year, month);

-- RLS
ALTER TABLE venue_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue owners can view their usage"
  ON venue_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Función para obtener límites según plan
CREATE OR REPLACE FUNCTION get_venue_limits(p_user_id UUID)
RETURNS TABLE (
  max_events_per_month INTEGER,
  max_featured_events INTEGER,
  can_send_notifications BOOLEAN,
  has_analytics BOOLEAN
) AS $$
DECLARE
  v_account_type TEXT;
  v_subscription_status TEXT;
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  SELECT account_type, subscription_status, trial_ends_at 
  INTO v_account_type, v_subscription_status, v_trial_ends_at
  FROM users 
  WHERE id = p_user_id;

  -- Si está en trial activo, dar acceso PRO (10 eventos/mes, 2 destacados)
  IF v_subscription_status = 'trial' AND v_trial_ends_at > NOW() THEN
    RETURN QUERY SELECT 10, 2, true, true;
    RETURN;
  END IF;

  -- Si es PRO o PREMIUM activo
  IF v_subscription_status = 'active' THEN
    IF v_account_type = 'venue_pro' THEN
      RETURN QUERY SELECT 10, 2, true, true;
      RETURN;
    ELSIF v_account_type = 'venue_premium' THEN
      RETURN QUERY SELECT 999999, 999999, true, true;
      RETURN;
    END IF;
  END IF;

  -- Plan FREE (por defecto)
  RETURN QUERY SELECT 4, 0, false, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si puede crear evento
CREATE OR REPLACE FUNCTION can_create_event(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_month INTEGER;
  v_current_year INTEGER;
  v_events_created INTEGER;
  v_max_events INTEGER;
BEGIN
  v_current_month := EXTRACT(MONTH FROM NOW());
  v_current_year := EXTRACT(YEAR FROM NOW());

  -- Obtener eventos creados este mes
  SELECT COALESCE(events_created, 0) INTO v_events_created
  FROM venue_usage
  WHERE user_id = p_user_id 
    AND month = v_current_month 
    AND year = v_current_year;

  -- Obtener límite del plan
  SELECT max_events_per_month INTO v_max_events
  FROM get_venue_limits(p_user_id);

  RETURN v_events_created < v_max_events;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_venue_limits IS 'Devuelve los límites según el plan de suscripción del venue';
COMMENT ON FUNCTION can_create_event IS 'Verifica si el venue puede crear otro evento este mes según su plan';
