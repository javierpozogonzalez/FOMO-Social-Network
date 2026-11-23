-- Insert sample events for Madrid
INSERT INTO events (title, description, venue_name, address, city, event_date, start_time, price, min_age, music_genre, is_featured) VALUES
('Noche de Reggaeton', 'La mejor fiesta de reggaeton de Madrid con los mejores DJs', 'Kapital', 'Calle de Atocha, 125', 'Madrid', CURRENT_DATE + INTERVAL '2 days', '23:00', 15.00, 18, 'Reggaeton', true),
('Electronic Night', 'Música electrónica hasta el amanecer', 'Fabrik', 'Av. de la Industria, 82', 'Madrid', CURRENT_DATE + INTERVAL '3 days', '00:00', 20.00, 18, 'Electrónica', false),
('Indie Rock Live', 'Concierto en vivo de bandas indie locales', 'Sala But', 'Calle de Barceló, 11', 'Madrid', CURRENT_DATE + INTERVAL '4 days', '21:00', 12.00, 16, 'Rock', false),
('Latin Vibes', 'Salsa, bachata y más ritmos latinos', 'Café Berlín', 'Costanilla de los Ángeles, 20', 'Madrid', CURRENT_DATE + INTERVAL '5 days', '22:00', 10.00, 18, 'Latina', false),
('House Music Session', 'Los mejores DJs de house music', 'Teatro Barceló', 'Calle de Barceló, 11', 'Madrid', CURRENT_DATE + INTERVAL '6 days', '23:30', 18.00, 18, 'House', false);

-- Insert sample events for Barcelona
INSERT INTO events (title, description, venue_name, address, city, event_date, start_time, price, min_age, music_genre, is_featured) VALUES
('Beach Party BCN', 'Fiesta en la playa con música tropical', 'Opium Barcelona', 'Passeig Marítim de la Barceloneta, 34', 'Barcelona', CURRENT_DATE + INTERVAL '2 days', '23:00', 20.00, 18, 'Tropical', true),
('Techno Underground', 'Techno de calidad en el mejor ambiente', 'Razzmatazz', 'Carrer dels Almogàvers, 122', 'Barcelona', CURRENT_DATE + INTERVAL '3 days', '00:00', 15.00, 18, 'Techno', false),
('Pop Hits Night', 'Los mejores éxitos del pop actual', 'Shôko Barcelona', 'Passeig Marítim de la Barceloneta, 36', 'Barcelona', CURRENT_DATE + INTERVAL '4 days', '23:00', 12.00, 18, 'Pop', false);
