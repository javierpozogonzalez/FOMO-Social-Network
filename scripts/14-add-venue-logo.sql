-- Agregar logo de la discoteca a los eventos
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS venue_logo TEXT;

-- Agregar logos con iniciales para discotecas de Madrid (funcionan siempre)
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Fabrik&background=1a1a1a&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Fabrik';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Teatro+Kapital&background=000000&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Teatro Kapital';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Joy+Eslava&background=8b0000&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Joy Eslava';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Goya+Social&background=2d3748&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Goya Social Club';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Opium&background=000000&color=gold&size=200&bold=true&format=png' WHERE venue_name = 'Opium Madrid';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Club+Cats&background=1a1a1a&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Club Cats';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Cool&background=6366f1&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Cool';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Mondo&background=ff0066&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Mondo Disko';

-- Logos para discotecas de Barcelona
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Razzmatazz&background=ff0000&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Razzmatazz';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Sala+Apolo&background=1a1a1a&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Sala Apolo';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Pacha&background=8b0000&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Pacha Barcelona';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Opium&background=000000&color=gold&size=200&bold=true&format=png' WHERE venue_name = 'Opium Barcelona';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Shoko&background=2d3748&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Shôko Barcelona';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=CDLC&background=8b4513&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'CDLC Barcelona';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Sutton&background=1a1a1a&color=gold&size=200&bold=true&format=png' WHERE venue_name = 'Sutton Barcelona';

-- Logos para discotecas de otras ciudades
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Mya&background=ff0066&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Mya Valencia';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Akuarela&background=00bfff&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Akuarela Playa';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Buddha&background=8b4513&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Buddha del Mar';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Cotton&background=2d3748&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Cotton Club';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Gold&background=ffd700&color=000&size=200&bold=true&format=png' WHERE venue_name = 'Sala Gold';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Oasis&background=32cd32&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Oasis Club';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Face&background=1a1a1a&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'The Face Club';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Umbracle&background=6366f1&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Umbracle Terraza';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Marina&background=00bfff&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Marina Beach Club';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Antique&background=8b4513&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Antique Sevilla';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Boss&background=1a1a1a&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Boss';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Fever&background=ff0000&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Fever';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Teatriz&background=8b0000&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Teatriz';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Republica&background=2d3748&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'República';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Moma&background=6366f1&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Moma';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=La+Ronda&background=ff0066&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'La Ronda';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Duo&background=1a1a1a&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Duo Club';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Bilborock&background=ff0000&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Discoteca Bilborock';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Badulake&background=2d3748&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Badulake';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Anden&background=6366f1&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Anden';
UPDATE events SET venue_logo = 'https://ui-avatars.com/api/?name=Wenge&background=8b4513&color=fff&size=200&bold=true&format=png' WHERE venue_name = 'Wenge Café';

-- Para eventos sin logo específico, generar con iniciales
UPDATE events 
SET venue_logo = 'https://ui-avatars.com/api/?name=' || REPLACE(venue_name, ' ', '+') || '&background=6366f1&color=fff&size=200&bold=true&format=png'
WHERE venue_logo IS NULL;

-- Verificar
SELECT title, venue_name, music_genre, venue_logo 
FROM events 
LIMIT 10;
