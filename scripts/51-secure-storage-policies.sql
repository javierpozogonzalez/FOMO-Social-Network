-- 51-secure-storage-policies.sql
-- Políticas restrictivas para buckets de storage

BEGIN;

-- Solo usuarios autenticados pueden subir avatares y fotos de eventos
CREATE POLICY "Usuarios autenticados suben avatares"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '/', 1)
    AND lower(right(name, 4)) IN ('.jpg', '.png', 'jpeg', 'webp')
    AND octet_length(content) < 5242880  -- Max 5MB
  );

CREATE POLICY "Usuarios autenticados suben imágenes de eventos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-images'
    AND auth.uid()::text = split_part(name, '/', 1)
    AND lower(right(name, 4)) IN ('.jpg', '.png', 'jpeg', 'webp')
    AND octet_length(content) < 5242880
  );

COMMIT;
