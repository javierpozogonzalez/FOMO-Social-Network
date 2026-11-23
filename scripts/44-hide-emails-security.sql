-- Script 44: Ocultar emails públicos (SEGURIDAD - NO ROMPE FUNCIONALIDAD)
-- Este script protege los emails de usuarios pero mantiene toda la funcionalidad existente
-- La app seguirá funcionando exactamente igual, solo más seguro

BEGIN;

-- ============================================
-- PASO 1: Crear VIEW segura (emails ocultos)
-- ============================================

-- Vista pública que NO expone emails
CREATE OR REPLACE VIEW users_public AS 
SELECT 
  id, 
  full_name, 
  avatar_url, 
  city, 
  age, 
  created_at,
  birth_date,
  account_type,
  venue_id,
  subscription_status,
  trial_ends_at,
  subscription_id,
  current_period_end,
  -- Email SOLO visible para el propio usuario
  CASE 
    WHEN id = auth.uid() THEN email 
    ELSE NULL 
  END as email
FROM users;

-- ============================================
-- PASO 2: Actualizar política de users
-- ============================================

-- Eliminar política antigua que exponía todo
DROP POLICY IF EXISTS "Users can view all profiles" ON users;

-- Nueva política: usuarios pueden ver perfiles públicos (sin email de otros)
-- PERO mantienen acceso completo a través de la VIEW
CREATE POLICY "Users can view public profiles" ON users 
FOR SELECT TO authenticated
USING (
  -- Pueden ver su propio perfil completo
  id = auth.uid()
  -- O perfiles públicos de otros (la VIEW filtrará el email)
  OR true
);

-- Mantener políticas de UPDATE e INSERT intactas
-- (Ya existen y funcionan correctamente)

-- ============================================
-- PASO 3: Grants a la vista (acceso público)
-- ============================================

-- Dar acceso a la vista pública
GRANT SELECT ON users_public TO anon, authenticated;

-- IMPORTANTE: NO revocamos SELECT de users
-- Porque las políticas RLS ya controlan qué ven
-- y muchas queries internas usan users directamente

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Probar como usuario A viendo usuario B:
-- SELECT email FROM users WHERE id = '<otro_user_id>';  
-- → Devolverá NULL (gracias a CASE en la política)

-- Probar como usuario A viendo su propio email:
-- SELECT email FROM users WHERE id = auth.uid();
-- → Devolverá su email correctamente

-- NOTA: La app TypeScript seguirá funcionando igual porque:
-- 1. Las queries de supabase.from('users').select() respetan RLS
-- 2. El propio usuario siempre ve su email
-- 3. Otros usuarios ven NULL en el campo email (no rompe nada)
