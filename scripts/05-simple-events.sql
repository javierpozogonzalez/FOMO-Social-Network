-- Solo eventos, sin usuarios mock
-- Ejecuta esto en Supabase SQL Editor

INSERT INTO events (title, description, venue_name, address, city, event_date, start_time, price, min_age, music_genre, is_featured, image_url) VALUES
-- Madrid
('Noche de Techno - Fabrik', 'La mejor noche de techno underground en Madrid', 'Fabrik', 'Av. de la Industria, 82', 'Madrid', '2025-10-30', '00:00', 25.00, 18, 'Techno', true, 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800'),
('Reggaeton Party - Kapital', 'Fiesta de reggaeton más grande de Madrid', 'Teatro Kapital', 'C. de Atocha, 125', 'Madrid', '2025-10-25', '23:30', 20.00, 18, 'Reggaeton', false, 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800'),
('House Music Night', 'House clásico toda la noche', 'Cool', 'C. de Isabel la Católica, 6', 'Madrid', '2025-10-26', '23:00', 15.00, 21, 'House', false, 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800'),
('Rock en Vivo', 'Bandas locales de rock', 'Moby Dick', 'Av. de Brasil, 5', 'Madrid', '2025-10-27', '21:00', 12.00, 18, 'Rock', false, 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=800'),
('Indie & Alternative', 'Indie y pop rock de los 2000', 'Wurlitzer Ballroom', 'C. de los Reyes, 3', 'Madrid', '2025-10-28', '22:30', 10.00, 18, 'Indie', false, 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800'),
('Latin Vibes', 'Salsa y bachata', 'Sala Bash', 'C. del Mesón de Paredes, 13', 'Madrid', '2025-10-29', '22:00', 8.00, 20, 'Latina', false, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800'),
('Electronic Dreams', 'Progressive house', 'Opium Madrid', 'Calle de José Abascal, 56', 'Madrid', '2025-10-31', '00:30', 22.00, 21, 'Electrónica', false, 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800'),
('Hip Hop Night', 'Old school hip hop', 'Palacio de la Prensa', 'Plaza del Callao, 4', 'Madrid', '2025-11-01', '23:00', 18.00, 18, 'Hip Hop', false, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800'),
('Pop & Comercial', 'Hits del momento', 'Joy Eslava', 'C. del Arenal, 11', 'Madrid', '2025-11-02', '00:00', 20.00, 18, 'Pop', false, 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800'),
('Deep House Session', 'Deep house y nu-disco', 'Goya Social Club', 'C. de Goya, 5', 'Madrid', '2025-11-03', '22:00', 16.00, 23, 'House', false, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800'),
('Drum & Bass', 'Mejor DnB de Madrid', 'Changó', 'C. del Corazón de María, 8', 'Madrid', '2025-11-04', '23:30', 12.00, 18, 'Drum & Bass', false, 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800'),
('90s Party', 'Britney y Backstreet Boys', 'But', 'C. de Barceló, 11', 'Madrid', '2025-11-05', '23:00', 10.00, 25, 'Pop', false, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800'),

-- Barcelona
('Techno Marathon', '12 horas de techno', 'Razzmatazz', 'C. de Pamplona, 88', 'Barcelona', '2025-10-26', '22:00', 30.00, 18, 'Techno', true, 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800'),
('House Sessions', 'House en Pacha', 'Pacha Barcelona', 'Av. del Doctor Marañón, 17', 'Barcelona', '2025-10-27', '00:00', 25.00, 21, 'House', false, 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800'),
('Underground Techno', 'Techno auténtico', 'Macarena Club', 'C. del Camí, 12', 'Barcelona', '2025-10-28', '23:00', 15.00, 18, 'Techno', false, 'https://images.unsplash.com/photo-1571266028243-d220c6ba2f88?w=800'),
('Reggaeton Beach', 'Reggaeton frente al mar', 'Opium Barcelona', 'Passeig Marítim, 34', 'Barcelona', '2025-10-29', '23:30', 20.00, 18, 'Reggaeton', false, 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800'),
('Indie Night', 'Bandas indie en directo', 'Sidecar', 'Plaça Reial, 7', 'Barcelona', '2025-10-30', '21:30', 12.00, 18, 'Indie', false, 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800'),
('Electronic Showcase', 'Electrónica experimental', 'Input', 'C. de Zamora, 78', 'Barcelona', '2025-10-31', '00:00', 18.00, 20, 'Electrónica', false, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800'),
('Jazz & Cocktails', 'Jazz en vivo', 'Jamboree', 'Plaça Reial, 17', 'Barcelona', '2025-11-01', '21:00', 15.00, 21, 'Jazz', false, 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800'),
('EDM Festival', 'Mejores DJs de EDM', 'CDLC Barcelona', 'Passeig Marítim, 32', 'Barcelona', '2025-11-02', '23:00', 28.00, 18, 'EDM', false, 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800');
