-- Script para eliminar usuario de prueba y probar registro
-- Ejecutar en Supabase SQL Editor

BEGIN;

-- Eliminar usuario de prueba de la tabla users
DELETE FROM users WHERE email LIKE '%javierpozoglez%' OR email LIKE '%jpozogo%';

-- Eliminar de auth.users (esto también eliminará de users por CASCADE)
DELETE FROM auth.users WHERE email LIKE '%javierpozoglez%' OR email LIKE '%jpozogo%';

COMMIT;

-- Verificar que se eliminó
SELECT id, email, email_verified FROM users ORDER BY created_at DESC LIMIT 5;
