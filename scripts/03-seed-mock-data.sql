-- ============================================
-- SCRIPT DE DATOS MOCK PARA SALGO APP
-- ============================================
-- Este script crea eventos de prueba
-- IMPORTANTE: Ejecuta este script DESPUÉS de crear las tablas (01-create-tables.sql)
-- 
-- NOTA: No creamos usuarios mock porque requieren autenticación en Supabase Auth
-- Los eventos se crearán sin un creador específico (created_by será NULL)

-- ============================================
-- 1. LIMPIAR DATOS EXISTENTES (OPCIONAL)
-- ============================================
-- Descomenta estas líneas si quieres limpiar todo antes de insertar
-- DELETE FROM event_chats;
-- DELETE FROM event_attendees;
-- DELETE FROM events;

-- ============================================
-- 2. NOTA SOBRE USUARIOS
-- ============================================
-- Los usuarios solo pueden crearse mediante registro en la app
-- Si quieres simular asistentes, usa tu propio usuario registrado

-- ============================================
-- 3. INSERTAR EVENTOS MOCK (20 eventos)
-- ============================================

-- Eventos de Madrid (12 eventos)
INSERT INTO events (id, title, description, event_date, start_time, venue_name, address, city, music_genre, price, min_age, max_age, is_featured, image_url, created_by, created_at) VALUES

-- Evento destacado
('e1111111-1111-1111-1111-111111111111', 
 'Noche de Techno en Fabrik', 
 'La mejor noche de techno underground en Madrid. DJs internacionales y producción de primera. No te pierdas esta experiencia única en una de las mejores salas de Europa.',
 '2025-10-30', '00:00', 'Fabrik', 'Av. de la Industria, 82, Humanes de Madrid', 'Madrid', 
 'Techno', 25.00, 18, NULL, true, 
 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800', NULL, NOW()),

('e2222222-2222-2222-2222-222222222222',
 'Reggaeton Party - Kapital',
 'La fiesta de reggaeton más grande de Madrid. 7 plantas de pura energía con los mejores DJs del momento. Perreo hasta el amanecer.',
 '2025-10-25', '23:30', 'Teatro Kapital', 'C. de Atocha, 125, Madrid', 'Madrid',
 'Reggaeton', 20.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800', NULL, NOW()),

('e3333333-3333-3333-3333-333333333333',
 'House Music Night - Cool',
 'House clásico y melodías que te harán bailar toda la noche. Ambiente chill y buena gente.',
 '2025-10-26', '23:00', 'Cool', 'C. de Isabel la Católica, 6, Madrid', 'Madrid',
 'House', 15.00, 21, NULL, false,
 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', NULL, NOW()),

('e4444444-4444-4444-4444-444444444444',
 'Rock en Vivo - Moby Dick',
 'Concierto de bandas locales de rock alternativo. Buena cerveza y mejor música en directo.',
 '2025-10-27', '21:00', 'Moby Dick', 'Av. de Brasil, 5, Madrid', 'Madrid',
 'Rock', 12.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=800', NULL, NOW()),

('e5555555-5555-5555-5555-555555555555',
 'Indie & Alternative - Wurlitzer Ballroom',
 '¿Echas de menos los 2000? Indie, pop rock y alternativo. Nostalgia musical garantizada.',
 '2025-10-28', '22:30', 'Wurlitzer Ballroom', 'C. de los Reyes, 3, Madrid', 'Madrid',
 'Indie', 10.00, 18, 35, false,
 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800', NULL, NOW()),

('e6666666-6666-6666-6666-666666666666',
 'Latin Vibes - Sala Bash',
 'Salsa, bachata y latin jazz. Ven a bailar ritmos latinos con la mejor onda.',
 '2025-10-29', '22:00', 'Sala Bash', 'C. del Mesón de Paredes, 13, Madrid', 'Madrid',
 'Latina', 8.00, 20, NULL, false,
 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800', NULL, NOW()),

('e7777777-7777-7777-7777-777777777777',
 'Electronic Dreams - Opium',
 'Progressive house y trance. Una experiencia electrónica inmersiva con visuales increíbles.',
 '2025-10-31', '00:30', 'Opium Madrid', 'Calle de José Abascal, 56, Madrid', 'Madrid',
 'Electrónica', 22.00, 21, NULL, false,
 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800', NULL, NOW()),

('e8888888-8888-8888-8888-888888888888',
 'Hip Hop Night - Palacio de la Prensa',
 'Old school y new school hip hop. Rap, breakdance y freestyle sessions.',
 '2025-11-01', '23:00', 'Palacio de la Prensa', 'Plaza del Callao, 4, Madrid', 'Madrid',
 'Hip Hop', 18.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800', NULL, NOW()),

('e9999999-9999-9999-9999-999999999999',
 'Pop & Comercial - Joy Eslava',
 'Los hits del momento en una de las discotecas más icónicas de Madrid.',
 '2025-11-02', '00:00', 'Joy Eslava', 'C. del Arenal, 11, Madrid', 'Madrid',
 'Pop', 20.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', NULL, NOW()),

('ea111111-1111-1111-1111-111111111111',
 'Deep House - Goya Social Club',
 'Deep house y nu-disco en un ambiente único. Rooftop con vistas increíbles.',
 '2025-11-03', '22:00', 'Goya Social Club', 'C. de Goya, 5, Madrid', 'Madrid',
 'House', 16.00, 23, NULL, false,
 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800', NULL, NOW()),

('eb111111-1111-1111-1111-111111111111',
 'Drum & Bass - Changó',
 'La mejor noche de DnB de Madrid. Liquid, neurofunk y jungle vibes.',
 '2025-11-04', '23:30', 'Changó', 'C. del Corazón de María, 8, Madrid', 'Madrid',
 'Drum & Bass', 12.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800', NULL, NOW()),

('ec111111-1111-1111-1111-111111111111',
 '90s & 2000s Party - But',
 '¿Te acuerdas de Britney, Backstreet Boys y Shakira? Revive los mejores hits.',
 '2025-11-05', '23:00', 'But', 'C. de Barceló, 11, Madrid', 'Madrid',
 'Pop', 10.00, 25, 45, false,
 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800', NULL, NOW()),

-- Eventos de Barcelona (8 eventos)
('ed111111-1111-1111-1111-111111111111',
 'Techno Marathon - Razzmatazz',
 '12 horas non-stop de techno con los mejores DJs europeos. Una experiencia épica.',
 '2025-10-26', '22:00', 'Razzmatazz', 'C. de Pamplona, 88, Barcelona', 'Barcelona',
 'Techno', 30.00, 18, NULL, true,
 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800', NULL, NOW()),

('ee111111-1111-1111-1111-111111111111',
 'House Sessions - Pacha Barcelona',
 'House music en el legendario Pacha. Ibiza vibes en Barcelona.',
 '2025-10-27', '00:00', 'Pacha Barcelona', 'Av. del Doctor Marañón, 17, Barcelona', 'Barcelona',
 'House', 25.00, 21, NULL, false,
 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', NULL, NOW()),

('ef111111-1111-1111-1111-111111111111',
 'Underground Techno - Macarena Club',
 'Techno underground en uno de los clubs más auténticos de Barcelona.',
 '2025-10-28', '23:00', 'Macarena Club', 'C. del Camí, 12, Barcelona', 'Barcelona',
 'Techno', 15.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800', NULL, NOW()),

('eg111111-1111-1111-1111-111111111111',
 'Reggaeton Beach Party - Opium Barcelona',
 'Reggaeton frente al mar. La mejor fiesta latina de Barcelona.',
 '2025-10-29', '23:30', 'Opium Barcelona', 'Passeig Marítim de la Barceloneta, 34, Barcelona', 'Barcelona',
 'Reggaeton', 20.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800', NULL, NOW()),

('eh111111-1111-1111-1111-111111111111',
 'Indie & Alternative - Sidecar',
 'Conciertos en directo de bandas indie locales e internacionales.',
 '2025-10-30', '21:30', 'Sidecar', 'Plaça Reial, 7, Barcelona', 'Barcelona',
 'Indie', 12.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800', NULL, NOW()),

('ei111111-1111-1111-1111-111111111111',
 'Electronic Showcase - Input',
 'Techno, house y electrónica experimental. Para los más exigentes.',
 '2025-10-31', '00:00', 'Input', 'C. de Zamora, 78, Barcelona', 'Barcelona',
 'Electrónica', 18.00, 20, NULL, false,
 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800', NULL, NOW()),

('ej111111-1111-1111-1111-111111111111',
 'Jazz & Cocktails - Jamboree',
 'Jazz en vivo en el club más legendario de Barcelona. Ambiente íntimo y elegante.',
 '2025-11-01', '21:00', 'Jamboree', 'Plaça Reial, 17, Barcelona', 'Barcelona',
 'Jazz', 15.00, 21, NULL, false,
 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800', NULL, NOW()),

('ek111111-1111-1111-1111-111111111111',
 'EDM Festival Night - CDLC',
 'Los mejores DJs de EDM en un club frente al mar. Visuales espectaculares.',
 '2025-11-02', '23:00', 'CDLC Barcelona', 'Passeig Marítim de la Barceloneta, 32, Barcelona', 'Barcelona',
 'EDM', 28.00, 18, NULL, false,
 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800', NULL, NOW());

-- ============================================
-- 4. NOTA: ASISTENTES Y RELACIONES
-- ============================================
-- Para simular asistentes, primero necesitas registrar usuarios en la app
-- Luego puedes apuntarte a eventos usando la app directamente
-- 
-- Si quieres añadir manualmente tu usuario a algún evento, usa:
-- INSERT INTO event_attendees (event_id, user_id, status, is_visible) VALUES
-- ('e1111111-1111-1111-1111-111111111111', 'TU_USER_ID_AQUI', 'going', true);
--
-- Para obtener tu USER_ID, ve a Supabase → Authentication → Users y copia tu ID

-- ============================================
-- RESUMEN DE DATOS INSERTADOS
-- ============================================
-- ✅ 20 eventos (12 en Madrid, 8 en Barcelona)
-- ✅ Eventos destacados marcados
-- ✅ Variedad de géneros musicales
-- ✅ Diferentes precios y edades
-- 
-- Para poblar con más datos:
-- 1. Registra usuarios en la app
-- 2. Apúntate a eventos desde la app
-- 3. Invita a amigos a registrarse
-- ============================================
