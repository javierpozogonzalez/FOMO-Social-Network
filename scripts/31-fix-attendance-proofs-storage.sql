-- Arreglar políticas de storage para el bucket attendance-proofs
-- El problema: las políticas esperaban user.id en el path, pero el código usa venue_id

-- Primero eliminamos las políticas existentes
DROP POLICY IF EXISTS "Los venues pueden ver sus comprobantes" ON storage.objects;
DROP POLICY IF EXISTS "Los venues pueden subir comprobantes" ON storage.objects;
DROP POLICY IF EXISTS "Los venues pueden actualizar sus comprobantes" ON storage.objects;
DROP POLICY IF EXISTS "Los venues pueden eliminar sus comprobantes" ON storage.objects;

-- Políticas corregidas: el primer folder es venue_id

-- Política: El venue owner puede VER sus propios comprobantes
CREATE POLICY "Los venues pueden ver sus comprobantes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-proofs'
  AND (storage.foldername(name))[1] IN (
    SELECT venue_id::text FROM users WHERE id = auth.uid() AND venue_id IS NOT NULL
  )
);

-- Política: El venue owner puede SUBIR comprobantes
CREATE POLICY "Los venues pueden subir comprobantes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attendance-proofs'
  AND (storage.foldername(name))[1] IN (
    SELECT venue_id::text FROM users WHERE id = auth.uid() AND venue_id IS NOT NULL
  )
);

-- Política: El venue owner puede ACTUALIZAR sus comprobantes
CREATE POLICY "Los venues pueden actualizar sus comprobantes"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attendance-proofs'
  AND (storage.foldername(name))[1] IN (
    SELECT venue_id::text FROM users WHERE id = auth.uid() AND venue_id IS NOT NULL
  )
);

-- Política: El venue owner puede ELIMINAR sus comprobantes
CREATE POLICY "Los venues pueden eliminar sus comprobantes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'attendance-proofs'
  AND (storage.foldername(name))[1] IN (
    SELECT venue_id::text FROM users WHERE id = auth.uid() AND venue_id IS NOT NULL
  )
);
