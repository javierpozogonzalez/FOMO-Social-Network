-- Script para poblar la base de datos con datos mock masivos
-- Ejecutar DESPUÉS de haber ejecutado los scripts 01-09

-- Primero, agregar constraint único a email si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

-- ==========================================
-- USUARIOS MOCK (100 usuarios de diferentes ciudades)
-- ==========================================
-- NOTA: Los usuarios mock deben crearse mediante el sistema de autenticación de Supabase
-- Este script solo actualiza usuarios existentes con datos adicionales

-- Actualizar usuarios existentes con ciudad y fecha de nacimiento
UPDATE users SET city = 'Madrid', birth_date = '1995-03-15' WHERE email = 'javier@test.com';

-- ==========================================
-- EVENTOS MOCK (80 eventos en diferentes ciudades)
-- ==========================================

-- Función helper para generar eventos
DO $$
DECLARE
  current_user_id UUID;
  
  -- Arrays de géneros musicales
  genres TEXT[] := ARRAY['Techno', 'House', 'Reggaeton', 'Pop', 'Rock', 'Indie', 'Electronic', 'Hip Hop', 'Latin', 'Jazz'];
  
  -- Arrays de nombres de eventos
  event_names TEXT[] := ARRAY[
    'Noche de Techno', 'Fiesta House', 'Reggaeton Party', 'Pop Night', 'Rock Festival',
    'Indie Session', 'Electronic Vibes', 'Hip Hop Night', 'Latin Party', 'Jazz Evening',
    'Sunset Session', 'Midnight Rave', 'Weekend Party', 'Summer Vibes', 'Urban Night',
    'Rooftop Party', 'Club Night', 'Beach Party', 'Underground Session', 'Festival Night'
  ];
  
  -- Arrays de imágenes para eventos
  event_images TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
    'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
    'https://images.unsplash.com/photo-1571266028243-d220c8f11e2c?w=800'
  ];
  
  -- Arrays de venues por ciudad
  venues_madrid TEXT[] := ARRAY['Fabrik', 'Teatro Kapital', 'Joy Eslava', 'Goya Social Club', 'Opium Madrid', 'Club Cats', 'Cool', 'Mondo Disko'];
  venues_barcelona TEXT[] := ARRAY['Razzmatazz', 'Sala Apolo', 'Pacha Barcelona', 'Opium Barcelona', 'Shôko Barcelona', 'CDLC Barcelona', 'Sutton Barcelona'];
  venues_valencia TEXT[] := ARRAY['Mya Valencia', 'Akuarela Playa', 'The Face Club', 'Umbracle Terraza', 'Marina Beach Club'];
  venues_sevilla TEXT[] := ARRAY['Buddha del Mar', 'Antique Sevilla', 'Boss', 'La Ronda', 'Duo Club'];
  venues_bilbao TEXT[] := ARRAY['Cotton Club', 'Fever', 'Discoteca Bilborock', 'Badulake'];
  venues_malaga TEXT[] := ARRAY['Sala Gold', 'Teatriz', 'Anden', 'Wenge Café'];
  venues_zaragoza TEXT[] := ARRAY['Oasis Club', 'República', 'Moma', 'Sala Rock & Blues'];
  
  i INTEGER;
  random_genre TEXT;
  random_name TEXT;
  random_venue TEXT;
  random_image TEXT;
  random_date DATE;
  city_name TEXT;
  venues TEXT[];
  
BEGIN
  -- Obtener el ID del usuario actual (necesitamos al menos un usuario existente)
  SELECT id INTO current_user_id FROM users LIMIT 1;
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuarios en la base de datos. Crea al menos un usuario primero.';
  END IF;

  -- Crear eventos para diferentes ciudades
  FOR city_name, venues IN 
    SELECT * FROM (VALUES 
      ('Madrid', venues_madrid),
      ('Barcelona', venues_barcelona),
      ('Valencia', venues_valencia),
      ('Sevilla', venues_sevilla),
      ('Bilbao', venues_bilbao),
      ('Málaga', venues_malaga),
      ('Zaragoza', venues_zaragoza)
    ) AS cities(city, venue_array)
  LOOP
    -- Crear entre 10-15 eventos por ciudad
    FOR i IN 1..(10 + floor(random() * 6))::integer LOOP
      random_genre := genres[1 + floor(random() * array_length(genres, 1))];
      random_name := event_names[1 + floor(random() * array_length(event_names, 1))] || ' - ' || random_genre;
      random_venue := venues[1 + floor(random() * array_length(venues, 1))];
      random_image := event_images[1 + floor(random() * array_length(event_images, 1))];
      random_date := CURRENT_DATE + (floor(random() * 60))::integer;
      
      INSERT INTO events (title, description, venue_name, address, city, event_date, start_time, end_time, price, min_age, music_genre, image_url, is_featured, created_by)
      VALUES (
        random_name,
        'Una noche increíble de ' || random_genre || ' en ' || city_name || '. ¡No te lo pierdas!',
        random_venue,
        'Calle Principal ' || i || ', ' || city_name,
        city_name,
        random_date,
        '23:00:00',
        '06:00:00',
        10 + floor(random() * 30),
        18,
        random_genre,
        random_image,
        (random() > 0.85),
        current_user_id
      );
    END LOOP;
  END LOOP;

END $$;

-- ==========================================
-- VERIFICACIÓN
-- ==========================================

-- Mostrar estadísticas
SELECT 'Eventos creados:' as info, COUNT(*) as total FROM events
UNION ALL
SELECT 'Asistencias existentes:', COUNT(*) FROM event_attendees;

SELECT 'Eventos por ciudad:' as info, city, COUNT(*) as total 
FROM events 
GROUP BY city 
ORDER BY total DESC;
