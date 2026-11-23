-- Script consolidado para:
-- 1. Incrementar automáticamente el contador de eventos
-- 2. Permitir plan FREE con status 'free'
-- Ejecutar en SQL Editor de Supabase

-- ===== PARTE 1: CONTADOR AUTOMÁTICO DE EVENTOS =====

-- Función que incrementa el contador en venue_usage cuando se crea un evento
CREATE OR REPLACE FUNCTION increment_venue_event_counter()
RETURNS TRIGGER AS $$
DECLARE
  v_month INTEGER;
  v_year INTEGER;
BEGIN
  -- Obtener mes y año del evento
  v_month := EXTRACT(MONTH FROM NEW.created_at);
  v_year := EXTRACT(YEAR FROM NEW.created_at);

  -- Insertar o actualizar el contador de eventos del venue
  INSERT INTO venue_usage (user_id, month, year, events_created, events_featured, notifications_sent)
  VALUES (NEW.created_by, v_month, v_year, 1, 0, 0)
  ON CONFLICT (user_id, month, year)
  DO UPDATE SET events_created = venue_usage.events_created + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta cuando se inserta un nuevo evento
DROP TRIGGER IF EXISTS trigger_increment_event_counter ON events;
CREATE TRIGGER trigger_increment_event_counter
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION increment_venue_event_counter();

COMMENT ON FUNCTION increment_venue_event_counter() IS 'Incrementa automáticamente events_created en venue_usage cuando se crea un evento';
COMMENT ON TRIGGER trigger_increment_event_counter ON events IS 'Trigger para incrementar contador de eventos por mes/año en venue_usage';


-- ===== PARTE 2: PERMITIR PLAN FREE CON STATUS 'FREE' =====

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
