-- ================================================
-- FIX: Permitir que service_role elimine usuarios
-- ================================================
-- Problema: Edge Function con service_role key no puede eliminar de tabla users
-- Solución: Crear política RLS específica para service_role

-- Primero verificar políticas actuales
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users';

-- Crear política para permitir DELETE con service_role
CREATE POLICY "Service role can delete users"
ON users
FOR DELETE
TO service_role
USING (true);

-- ALTERNATIVA: Si prefieres que el usuario pueda eliminar su propia cuenta
-- (sin necesidad de Edge Function)
CREATE POLICY "Users can delete their own account"
ON users
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Verificar que se creó correctamente
SELECT 
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'users' 
  AND cmd = 'DELETE';
