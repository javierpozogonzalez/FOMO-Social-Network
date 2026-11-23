-- Script para incrementar automáticamente el contador de eventos cuando se crea uno
-- Ejecutar en SQL Editor de Supabase

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

-- Comentarios
COMMENT ON FUNCTION increment_venue_event_counter() IS 'Incrementa automáticamente events_created en venue_usage cuando se crea un evento';
COMMENT ON TRIGGER trigger_increment_event_counter ON events IS 'Trigger para incrementar contador de eventos por mes/año en venue_usage';
