-- =====================================================
-- Script 36: Agregar venue_id a tabla events
-- =====================================================
-- Problema: Los eventos usan venue_name + city (que pueden cambiar)
-- Solución: Usar venue_id (UUID inmutable) como foreign key

-- Paso 1: Agregar columna venue_id a la tabla events
ALTER TABLE events
ADD COLUMN venue_id UUID REFERENCES venue_applications(id);

-- Paso 2: Migrar datos existentes - llenar venue_id basándose en venue_name + city
UPDATE events e
SET venue_id = va.id
FROM venue_applications va
WHERE e.venue_name = va.venue_name
  AND e.city = va.city;

-- Paso 3: Verificar que todos los eventos tienen venue_id
SELECT 
  COUNT(*) as total_eventos,
  COUNT(venue_id) as eventos_con_venue_id,
  COUNT(*) - COUNT(venue_id) as eventos_sin_venue_id
FROM events;

-- Paso 4: Mostrar eventos que NO pudieron ser asignados (si hay alguno)
SELECT 
  id,
  title,
  venue_name,
  city,
  event_date
FROM events
WHERE venue_id IS NULL;

-- Paso 5: Crear índice para mejorar rendimiento
CREATE INDEX idx_events_venue_id ON events(venue_id);

-- Paso 6: Verificar los eventos de Posada de las Ánimas
SELECT 
  e.id,
  e.title,
  e.venue_name,
  e.city,
  e.venue_id,
  va.venue_name as venue_name_from_app
FROM events e
LEFT JOIN venue_applications va ON e.venue_id = va.id
WHERE va.venue_name LIKE '%Posada%'
   OR e.venue_name LIKE '%Posada%';

-- NOTA: NO hacemos venue_id NOT NULL todavía por si hay eventos huérfanos
-- Si en el futuro queremos hacer venue_id obligatorio:
-- ALTER TABLE events ALTER COLUMN venue_id SET NOT NULL;
