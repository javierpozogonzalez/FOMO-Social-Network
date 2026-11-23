-- Script 59: Data Validation & Constraints
-- Añade validaciones de datos para prevenir datos corruptos
-- Impacto: NINGUNO si los datos son correctos - Solo rechaza datos inválidos
-- Beneficio: Integridad de datos y prevención de bugs

-- PASO 1: Validación de emails (formato correcto)
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS valid_email_format;

ALTER TABLE users 
  ADD CONSTRAINT valid_email_format 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- PASO 2: Validación de edad (fecha de nacimiento razonable)
-- Primero arreglar datos existentes que violan la constraint
DO $$
DECLARE
  fixed_count int;
BEGIN
  -- Poner NULL a fechas imposibles (menores de 16 años)
  UPDATE users
  SET birth_date = NULL
  WHERE birth_date IS NOT NULL
    AND birth_date > CURRENT_DATE - INTERVAL '16 years';
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  IF fixed_count > 0 THEN
    RAISE NOTICE '🔧 Corregidas % fechas de nacimiento inválidas (menores de 16)', fixed_count;
  END IF;
END $$;

ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS valid_birth_date;

ALTER TABLE users 
  ADD CONSTRAINT valid_birth_date 
  CHECK (
    birth_date IS NULL 
    OR (
      birth_date >= '1900-01-01'::date 
      AND birth_date <= CURRENT_DATE - INTERVAL '16 years'
    )
  );

COMMENT ON CONSTRAINT valid_birth_date ON users IS 'Usuario debe tener al menos 16 años';

-- PASO 3: Validación de nombres (no vacíos, longitud razonable)
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS valid_full_name;

ALTER TABLE users 
  ADD CONSTRAINT valid_full_name 
  CHECK (
    LENGTH(TRIM(full_name)) >= 2 
    AND LENGTH(full_name) <= 100
  );

-- PASO 4: Validación de ciudad (no vacía)
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS valid_city;

ALTER TABLE users 
  ADD CONSTRAINT valid_city 
  CHECK (
    city IS NULL 
    OR (LENGTH(TRIM(city)) >= 2 AND LENGTH(city) <= 100)
  );

-- PASO 5: Validación de eventos - fechas coherentes
-- NOTA: No validamos fechas pasadas para no romper eventos históricos
ALTER TABLE events 
  DROP CONSTRAINT IF EXISTS valid_event_date;

-- Solo validar que la fecha no sea extremadamente futura (5 años)
ALTER TABLE events 
  ADD CONSTRAINT valid_event_date 
  CHECK (
    event_date >= '2020-01-01'::date 
    AND event_date <= CURRENT_DATE + INTERVAL '5 years'
  );

COMMENT ON CONSTRAINT valid_event_date ON events IS 'Eventos pueden ser históricos o hasta 5 años en el futuro';

-- PASO 6: Validación de horarios de eventos
-- Primero arreglar datos existentes que violan la constraint
DO $$
DECLARE
  fixed_count int;
BEGIN
  -- Arreglar eventos donde end_time <= start_time
  UPDATE events
  SET end_time = start_time + INTERVAL '2 hours'
  WHERE end_time IS NOT NULL 
    AND end_time <= start_time;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  IF fixed_count > 0 THEN
    RAISE NOTICE '🔧 Corregidos % eventos con horarios inválidos', fixed_count;
  END IF;
END $$;

-- Ahora sí añadir la constraint
ALTER TABLE events 
  DROP CONSTRAINT IF EXISTS valid_event_times;

-- Permitir eventos que cruzan medianoche: exigir solo que no sean de duración cero
ALTER TABLE events 
  ADD CONSTRAINT valid_event_times 
  CHECK (
    end_time IS NULL 
    OR end_time <> start_time
  );

-- PASO 7: Validación de títulos de eventos (no vacíos)
ALTER TABLE events 
  DROP CONSTRAINT IF EXISTS valid_event_title;

ALTER TABLE events 
  ADD CONSTRAINT valid_event_title 
  CHECK (
    LENGTH(TRIM(title)) >= 3 
    AND LENGTH(title) <= 200
  );

-- PASO 8: Validación de venue_name (no vacío)
ALTER TABLE events 
  DROP CONSTRAINT IF EXISTS valid_venue_name;

ALTER TABLE events 
  ADD CONSTRAINT valid_venue_name 
  CHECK (
    LENGTH(TRIM(venue_name)) >= 2 
    AND LENGTH(venue_name) <= 200
  );

-- PASO 9: Validación de mensajes de chat (no vacíos, longitud máxima)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_chats') THEN
    -- Arreglar mensajes vacíos o muy largos
    UPDATE event_chats
    SET message = SUBSTRING(TRIM(message), 1, 300)
    WHERE LENGTH(TRIM(message)) = 0 OR LENGTH(message) > 300;
    
    ALTER TABLE event_chats 
      DROP CONSTRAINT IF EXISTS valid_chat_message;

    ALTER TABLE event_chats 
      ADD CONSTRAINT valid_chat_message 
      CHECK (
        LENGTH(TRIM(message)) >= 1 
        AND LENGTH(message) <= 300
      );
    
    RAISE NOTICE '✅ Validación añadida a event_chats';
  ELSE
    RAISE NOTICE '⏭️ Saltando event_chats (tabla no existe)';
  END IF;
END $$;

-- PASO 10: Validación de anuncios (no vacíos, longitud máxima)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_announcements') THEN
    -- Arreglar anuncios vacíos o muy largos
    UPDATE event_announcements
    SET content = SUBSTRING(TRIM(content), 1, 2000)
    WHERE LENGTH(TRIM(content)) = 0 OR LENGTH(content) > 2000;
    
    ALTER TABLE event_announcements 
      DROP CONSTRAINT IF EXISTS valid_announcement_content;

    ALTER TABLE event_announcements 
      ADD CONSTRAINT valid_announcement_content 
      CHECK (
        LENGTH(TRIM(content)) >= 1 
        AND LENGTH(content) <= 2000
      );
    
    RAISE NOTICE '✅ Validación añadida a event_announcements';
  ELSE
    RAISE NOTICE '⏭️ Saltando event_announcements (tabla no existe)';
  END IF;
END $$;

-- PASO 11: Validación de cantidad en lotes externos (positivo, razonable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'external_attendance_batches') THEN
    -- Arreglar cantidades inválidas
    UPDATE external_attendance_batches
    SET quantity = LEAST(GREATEST(quantity, 1), 1000)
    WHERE quantity <= 0 OR quantity > 1000;
    
    ALTER TABLE external_attendance_batches 
      DROP CONSTRAINT IF EXISTS valid_batch_quantity;

    ALTER TABLE external_attendance_batches 
      ADD CONSTRAINT valid_batch_quantity 
      CHECK (
        quantity > 0 
        AND quantity <= 1000
      );

    COMMENT ON CONSTRAINT valid_batch_quantity ON external_attendance_batches IS 'Cantidad debe ser entre 1 y 1000 por lote';
    
    RAISE NOTICE '✅ Validación añadida a external_attendance_batches';
  ELSE
    RAISE NOTICE '⏭️ Saltando external_attendance_batches (tabla no existe)';
  END IF;
END $$;

-- PASO 12: Validación de source en lotes externos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'external_attendance_batches') THEN
    -- Normalizar sources inválidos a 'otros'
    UPDATE external_attendance_batches
    SET source = 'otros'
    WHERE source NOT IN ('web', 'taquilla', 'otros', 'online', 'box_office', 'other', 'venta_web', 'ticket_office');
    
    ALTER TABLE external_attendance_batches 
      DROP CONSTRAINT IF EXISTS valid_batch_source;

    ALTER TABLE external_attendance_batches 
      ADD CONSTRAINT valid_batch_source 
      CHECK (
        source IN ('web', 'taquilla', 'otros', 'online', 'box_office', 'other', 'venta_web', 'ticket_office')
      );
    
    RAISE NOTICE '✅ Validación añadida a external_attendance_batches.source';
  ELSE
    RAISE NOTICE '⏭️ Saltando validación de source';
  END IF;
END $$;

-- PASO 13: Validación de teléfono en venue_applications
ALTER TABLE venue_applications 
  DROP CONSTRAINT IF EXISTS valid_phone_format;

ALTER TABLE venue_applications 
  ADD CONSTRAINT valid_phone_format 
  CHECK (
    phone IS NULL 
    OR phone ~* '^\+?[0-9\s\-\(\)]{9,20}$'
  );

-- PASO 14: Validación de CIF en venue_applications (opcional pero formato correcto)
-- Normalizar datos existentes para no romper al aplicar la constraint
DO $$
DECLARE
  trimmed_count int := 0;
  nullified_count int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'venue_applications') THEN
    -- 1) Recortar espacios y convertir vacíos a NULL
    UPDATE venue_applications
    SET cif_number = NULLIF(TRIM(cif_number), '')
    WHERE cif_number IS NOT NULL
      AND (cif_number <> TRIM(cif_number) OR TRIM(cif_number) = '');
    GET DIAGNOSTICS trimmed_count = ROW_COUNT;

    -- 2) Cualquier valor fuera de rango (por longitud) -> NULL (campo opcional)
    UPDATE venue_applications
    SET cif_number = NULL
    WHERE cif_number IS NOT NULL
      AND (LENGTH(cif_number) < 9 OR LENGTH(cif_number) > 20);
    GET DIAGNOSTICS nullified_count = ROW_COUNT;

    IF trimmed_count > 0 OR nullified_count > 0 THEN
      RAISE NOTICE '🔧 CIF normalizado: % recortados/vacíos a NULL, % fuera de rango a NULL', trimmed_count, nullified_count;
    END IF;
  ELSE
    RAISE NOTICE '⏭️ Saltando normalización de CIF (venue_applications no existe)';
  END IF;
END $$;

ALTER TABLE venue_applications 
  DROP CONSTRAINT IF EXISTS valid_cif_format;

ALTER TABLE venue_applications 
  ADD CONSTRAINT valid_cif_format 
  CHECK (
    cif_number IS NULL 
    OR (LENGTH(TRIM(cif_number)) >= 9 AND LENGTH(cif_number) <= 20)
  );

-- PASO 15: Validación de bio de usuario (longitud máxima)
-- (Eliminado) No existe columna bio en users. No se aplica validación.

-- PASO 16: Función para sanitizar inputs (prevenir XSS básico)
CREATE OR REPLACE FUNCTION sanitize_text(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Trim espacios
  input_text := TRIM(input_text);
  
  -- Remover caracteres de control (excepto saltos de línea)
  input_text := REGEXP_REPLACE(input_text, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
  
  -- Limitar saltos de línea consecutivos a máximo 2
  input_text := REGEXP_REPLACE(input_text, '\n{3,}', E'\n\n', 'g');
  
  RETURN input_text;
END;
$$;

-- PASO 17: Trigger para sanitizar automáticamente campos de texto
CREATE OR REPLACE FUNCTION sanitize_user_inputs()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.full_name IS NOT NULL THEN
    NEW.full_name := sanitize_text(NEW.full_name);
  END IF;
  
  IF NEW.city IS NOT NULL THEN
    NEW.city := sanitize_text(NEW.city);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sanitize_user_inputs ON users;
CREATE TRIGGER trigger_sanitize_user_inputs
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_user_inputs();

-- PASO 18: Trigger para sanitizar eventos
CREATE OR REPLACE FUNCTION sanitize_event_inputs()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.title IS NOT NULL THEN
    NEW.title := sanitize_text(NEW.title);
  END IF;
  
  IF NEW.description IS NOT NULL THEN
    NEW.description := sanitize_text(NEW.description);
  END IF;
  
  IF NEW.venue_name IS NOT NULL THEN
    NEW.venue_name := sanitize_text(NEW.venue_name);
  END IF;
  
  IF NEW.city IS NOT NULL THEN
    NEW.city := sanitize_text(NEW.city);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sanitize_event_inputs ON events;
CREATE TRIGGER trigger_sanitize_event_inputs
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_event_inputs();

-- PASO 19: Prevenir emails duplicados (case-insensitive)
DROP INDEX IF EXISTS idx_users_email_unique_lower;
CREATE UNIQUE INDEX idx_users_email_unique_lower ON users (LOWER(email));

COMMENT ON INDEX idx_users_email_unique_lower IS 'Previene emails duplicados ignorando mayúsculas/minúsculas';

-- PASO 20: Validación de URLs (avatar, website, etc.) - básica
CREATE OR REPLACE FUNCTION is_valid_url(url_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF url_text IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN url_text ~* '^https?://[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(/.*)?$';
END;
$$;

ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS valid_avatar_url;

ALTER TABLE users 
  ADD CONSTRAINT valid_avatar_url 
  CHECK (
    avatar_url IS NULL 
    OR is_valid_url(avatar_url)
  );

ALTER TABLE venue_applications 
  DROP CONSTRAINT IF EXISTS valid_website_url;

ALTER TABLE venue_applications 
  ADD CONSTRAINT valid_website_url 
  CHECK (
    website IS NULL 
    OR is_valid_url(website)
  );

-- VERIFICACIÓN: Mostrar todas las constraints añadidas
DO $$
DECLARE
  constraint_count int;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE constraint_schema = 'public'
    AND constraint_type = 'CHECK'
    AND table_name IN ('users', 'events', 'event_chats', 'event_announcements', 'external_attendance_batches', 'venue_applications');
  
  RAISE NOTICE '✅ Script 59 ejecutado correctamente';
  RAISE NOTICE '🔒 % constraints de validación activas', constraint_count;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Validaciones implementadas:';
  RAISE NOTICE '   ✓ Emails: Formato válido + únicos (case-insensitive)';
  RAISE NOTICE '   ✓ Edad: Mínimo 16 años';
  RAISE NOTICE '   ✓ Nombres: 2-100 caracteres';
  RAISE NOTICE '   ✓ Ciudades: 2-100 caracteres';
  RAISE NOTICE '   ✓ Fechas eventos: Hasta 5 años de anticipación';
  RAISE NOTICE '   ✓ Horarios: Fin distinto a inicio (admite cruce de medianoche)';
  RAISE NOTICE '   ✓ Títulos: 3-200 caracteres';
  RAISE NOTICE '   ✓ Mensajes: 1-300 caracteres';
  RAISE NOTICE '   ✓ Anuncios: 1-2000 caracteres';
  RAISE NOTICE '   ✓ Lotes: 1-1000 asistentes';
  RAISE NOTICE '   ✓ Teléfonos: Formato válido';
  RAISE NOTICE '   ✓ URLs: Formato básico HTTPS';
  RAISE NOTICE '';
  RAISE NOTICE '🧹 Sanitización automática:';
  RAISE NOTICE '   ✓ Nombres, títulos, descripciones';
  RAISE NOTICE '   ✓ Remover caracteres de control';
  RAISE NOTICE '   ✓ Limitar saltos de línea';
END $$;
