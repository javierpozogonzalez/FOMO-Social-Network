-- Script para crear el bucket de avatars en Supabase Storage
-- Ejecuta esto en el SQL Editor de Supabase

-- Crear el bucket si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir que cualquiera vea los avatars (público)
CREATE POLICY "Los avatars son visibles públicamente"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Política para permitir que usuarios autenticados suban sus avatars
CREATE POLICY "Los usuarios pueden subir sus propios avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuarios autenticados actualicen sus avatars
CREATE POLICY "Los usuarios pueden actualizar sus propios avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuarios autenticados eliminen sus avatars
CREATE POLICY "Los usuarios pueden eliminar sus propios avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
