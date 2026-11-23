-- ============================================
-- SCRIPT COMPLETO CON USUARIOS MOCK Y EVENTOS
-- ============================================
-- IMPORTANTE: Este script crea usuarios directamente en auth.users
-- Ejecuta esto en el SQL Editor de Supabase

-- ============================================
-- 1. CREAR USUARIOS MOCK EN AUTH.USERS
-- ============================================
-- Insertamos usuarios directamente en la tabla de autenticación de Supabase

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_sent_at
) VALUES
-- Usuario 1: Carlos
('11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carlos.mock@salgo.app', 
 '$2a$10$abcdefghijklmnopqrstuv', NOW(), '', '', '', '', NOW(), NOW(), 
 '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, NOW()),

-- Usuario 2: Laura
('22222222-2222-2222-2222-222222222222'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'laura.mock@salgo.app',
 '$2a$10$abcdefghijklmnopqrstuv', NOW(), '', '', '', '', NOW(), NOW(),
 '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, NOW()),

-- Usuario 3: David
('33333333-3333-3333-3333-333333333333'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'david.mock@salgo.app',
 '$2a$10$abcdefghijklmnopqrstuv', NOW(), '', '', '', '', NOW(), NOW(),
 '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, NOW()),

-- Usuario 4: María
('44444444-4444-4444-4444-444444444444'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maria.mock@salgo.app',
 '$2a$10$abcdefghijklmnopqrstuv', NOW(), '', '', '', '', NOW(), NOW(),
 '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, NOW()),

-- Usuario 5: Pablo
('55555555-5555-5555-5555-555555555555'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pablo.mock@salgo.app',
 '$2a$10$abcdefghijklmnopqrstuv', NOW(), '', '', '', '', NOW(), NOW(),
 '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, NOW());

-- ============================================
-- 2. CREAR PERFILES DE USUARIOS
-- ============================================

INSERT INTO users (id, email, full_name, city, age, avatar_url, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'carlos.mock@salgo.app', 'Carlos Martínez', 'Madrid', 28, 'https://i.pravatar.cc/150?img=12', NOW()),
('22222222-2222-2222-2222-222222222222', 'laura.mock@salgo.app', 'Laura García', 'Madrid', 25, 'https://i.pravatar.cc/150?img=45', NOW()),
('33333333-3333-3333-3333-333333333333', 'david.mock@salgo.app', 'David López', 'Madrid', 30, 'https://i.pravatar.cc/150?img=33', NOW()),
('44444444-4444-4444-4444-444444444444', 'maria.mock@salgo.app', 'María Ruiz', 'Madrid', 27, 'https://i.pravatar.cc/150?img=47', NOW()),
('55555555-5555-5555-5555-555555555555', 'pablo.mock@salgo.app', 'Pablo Sánchez', 'Madrid', 32, 'https://i.pravatar.cc/150?img=15', NOW());

-- ============================================
-- 3. INSERTAR EVENTOS (20 eventos)
-- ============================================

INSERT INTO events (id, title, description, event_date, start_time, venue_name, address, city, music_genre, price, min_age, max_age, is_featured, image_url, created_by, created_at) VALUES

-- Evento destacado de Madrid
('e1111111-1111-1111-1111-111111111111', 
 'Noche de Techno en Fabrik', 
 'La mejor noche de techno underground en Madrid. DJs internacionales y producción de primera.',
 '2025-10-30', '00:00', 'Fabrik', 'Av. de la Industria, 82, Humanes de Madrid', 'Madrid', 
 'Techno', 25.00, 18, NULL, true, 
 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800', '11111111-1111-1111-1111-111111111111', NOW()),

('e2222222-2222-2222-2222-222222222222',
 'Reggaeton Party - Kapital',
 'La fiesta de reggaeton más grande de Madrid. 7 plantas de pura energía.',
 '2025-10-25', '23:30', 'Teatro Kapital', 'C. de Atocha, 125, Madrid', 'Madrid',
 'Reggaeton', 20.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800', '22222222-2222-2222-2222-222222222222', NOW()),

('e3333333-3333-3333-3333-333333333333',
 'House Music Night - Cool',
 'House clásico y melodías que te harán bailar toda la noche.',
 '2025-10-26', '23:00', 'Cool', 'C. de Isabel la Católica, 6, Madrid', 'Madrid',
 'House', 15.00, 21, NULL, false,
 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', '11111111-1111-1111-1111-111111111111', NOW()),

('e4444444-4444-4444-4444-444444444444',
 'Rock en Vivo - Moby Dick',
 'Concierto de bandas locales de rock alternativo.',
 '2025-10-27', '21:00', 'Moby Dick', 'Av. de Brasil, 5, Madrid', 'Madrid',
 'Rock', 12.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=800', '33333333-3333-3333-3333-333333333333', NOW()),

('e5555555-5555-5555-5555-555555555555',
 'Indie & Alternative - Wurlitzer',
 '¿Echas de menos los 2000? Indie y pop rock.',
 '2025-10-28', '22:30', 'Wurlitzer Ballroom', 'C. de los Reyes, 3, Madrid', 'Madrid',
 'Indie', 10.00, 18, 35, false,
 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800', '22222222-2222-2222-2222-222222222222', NOW()),

('e6666666-6666-6666-6666-666666666666',
 'Latin Vibes - Sala Bash',
 'Salsa, bachata y latin jazz.',
 '2025-10-29', '22:00', 'Sala Bash', 'C. del Mesón de Paredes, 13, Madrid', 'Madrid',
 'Latina', 8.00, 20, NULL, false,
 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800', '44444444-4444-4444-4444-444444444444', NOW()),

('e7777777-7777-7777-7777-777777777777',
 'Electronic Dreams - Opium',
 'Progressive house y trance.',
 '2025-10-31', '00:30', 'Opium Madrid', 'Calle de José Abascal, 56, Madrid', 'Madrid',
 'Electrónica', 22.00, 21, NULL, false,
 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800', '55555555-5555-5555-5555-555555555555', NOW()),

('e8888888-8888-8888-8888-888888888888',
 'Hip Hop Night - Palacio de la Prensa',
 'Old school y new school hip hop.',
 '2025-11-01', '23:00', 'Palacio de la Prensa', 'Plaza del Callao, 4, Madrid', 'Madrid',
 'Hip Hop', 18.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800', NULL, NOW()),

('e9999999-9999-9999-9999-999999999999',
 'Pop & Comercial - Joy Eslava',
 'Los hits del momento.',
 '2025-11-02', '00:00', 'Joy Eslava', 'C. del Arenal, 11, Madrid', 'Madrid',
 'Pop', 20.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', NULL, NOW()),

('ea111111-1111-1111-1111-111111111111',
 'Deep House - Goya Social Club',
 'Deep house y nu-disco.',
 '2025-11-03', '22:00', 'Goya Social Club', 'C. de Goya, 5, Madrid', 'Madrid',
 'House', 16.00, 23, NULL, false,
 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800', NULL, NOW()),

('eb111111-1111-1111-1111-111111111111',
 'Drum & Bass - Changó',
 'La mejor noche de DnB de Madrid.',
 '2025-11-04', '23:30', 'Changó', 'C. del Corazón de María, 8, Madrid', 'Madrid',
 'Drum & Bass', 12.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800', NULL, NOW()),

('ec111111-1111-1111-1111-111111111111',
 '90s & 2000s Party - But',
 'Revive los mejores hits de Britney y Backstreet Boys.',
 '2025-11-05', '23:00', 'But', 'C. de Barceló, 11, Madrid', 'Madrid',
 'Pop', 10.00, 25, 45, false,
 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800', NULL, NOW()),

-- Eventos de Barcelona
('ed111111-1111-1111-1111-111111111111',
 'Techno Marathon - Razzmatazz',
 '12 horas non-stop de techno.',
 '2025-10-26', '22:00', 'Razzmatazz', 'C. de Pamplona, 88, Barcelona', 'Barcelona',
 'Techno', 30.00, 18, NULL, true,
 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800', NULL, NOW()),

('ee111111-1111-1111-1111-111111111111',
 'House Sessions - Pacha Barcelona',
 'House music en el legendario Pacha.',
 '2025-10-27', '00:00', 'Pacha Barcelona', 'Av. del Doctor Marañón, 17, Barcelona', 'Barcelona',
 'House', 25.00, 21, NULL, false,
 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', NULL, NOW()),

('ef111111-1111-1111-1111-111111111111',
 'Underground Techno - Macarena',
 'Techno underground auténtico.',
 '2025-10-28', '23:00', 'Macarena Club', 'C. del Camí, 12, Barcelona', 'Barcelona',
 'Techno', 15.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800', NULL, NOW()),

('e0111111-1111-1111-1111-111111111111',
 'Reggaeton Beach - Opium BCN',
 'Reggaeton frente al mar.',
 '2025-10-29', '23:30', 'Opium Barcelona', 'Passeig Marítim, 34, Barcelona', 'Barcelona',
 'Reggaeton', 20.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800', NULL, NOW()),

('eh111111-1111-1111-1111-111111111111',
 'Indie & Alternative - Sidecar',
 'Conciertos indie en directo.',
 '2025-10-30', '21:30', 'Sidecar', 'Plaça Reial, 7, Barcelona', 'Barcelona',
 'Indie', 12.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800', NULL, NOW()),

('ei111111-1111-1111-1111-111111111111',
 'Electronic Showcase - Input',
 'Electrónica experimental.',
 '2025-10-31', '00:00', 'Input', 'C. de Zamora, 78, Barcelona', 'Barcelona',
 'Electrónica', 18.00, 20, NULL, false,
 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800', NULL, NOW()),

('ej111111-1111-1111-1111-111111111111',
 'Jazz & Cocktails - Jamboree',
 'Jazz en vivo.',
 '2025-11-01', '21:00', 'Jamboree', 'Plaça Reial, 17, Barcelona', 'Barcelona',
 'Jazz', 15.00, 21, NULL, false,
 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800', NULL, NOW()),

('ek111111-1111-1111-1111-111111111111',
 'EDM Festival Night - CDLC',
 'Los mejores DJs de EDM.',
 '2025-11-02', '23:00', 'CDLC Barcelona', 'Passeig Marítim, 32, Barcelona', 'Barcelona',
 'EDM', 28.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', NULL, NOW());

-- ============================================
-- 4. ASISTENTES A EVENTOS
-- ============================================

INSERT INTO event_attendees (event_id, user_id, status, is_visible) VALUES
-- Techno Fabrik (evento destacado) - 4 asistentes
('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'going', true),
('e1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'going', true),
('e1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'going', true),
('e1111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'going', true),

-- Reggaeton Kapital - 3 asistentes
('e2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'going', true),
('e2222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'going', true),
('e2222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'going', true),

-- House Night - 2 asistentes
('e3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'going', true),
('e3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'going', true),

-- Rock - 2 asistentes
('e4444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'going', true),
('e4444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', 'going', true),

-- Indie - 2 asistentes
('e5555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'going', true),
('e5555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 'going', true);

-- ============================================
-- 5. AMISTADES
-- ============================================

INSERT INTO friendships (user_id, friend_id, status) VALUES
-- Carlos es amigo de Laura, David y Pablo
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'accepted'),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'accepted'),
('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'accepted'),

-- Laura es amiga de María
('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'accepted'),

-- David es amigo de Pablo
('33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', 'accepted'),

-- María tiene solicitud pendiente de Pablo
('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', 'pending');

-- ============================================
-- 6. MENSAJES DE CHAT
-- ============================================

INSERT INTO event_chats (event_id, user_id, message) VALUES
-- Chat en Techno Fabrik
('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '¡Quién va a esta! 🔥'),
('e1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Yo voy!! 💃'),
('e1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Nos vemos allí tíos'),
('e1111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Tiene guardarropa? 🎒'),

-- Chat en Reggaeton
('e2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'PERREO INTENSO 🔥🔥'),
('e2222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'Nos vemos!! 💕');

-- ============================================
-- RESUMEN
-- ============================================
-- ✅ 5 usuarios mock creados (Carlos, Laura, David, María, Pablo)
-- ✅ 20 eventos (12 Madrid, 8 Barcelona)
-- ✅ 13 relaciones de asistencia a eventos
-- ✅ 6 amistades (5 confirmadas, 1 pendiente)
-- ✅ 6 mensajes de chat
-- ============================================
