-- Script para arreglar el tipo de email_verified y marcar usuarios existentes como verificados
-- Fecha: 15 de noviembre de 2025

-- PASO 1: Marcar TODOS los usuarios existentes (excepto antonalfretdosanchez) como verificados
UPDATE users
SET email_verified = true
WHERE email_verified IS NULL 
   OR email_verified = false
   OR email IN (
     'javierpozonfw@gmail.com',
     'josepozo.abogado@gmail.com',
     'javierpozogonzalez@gmail.com',
     'jpozogo.inf@upsa.es',
     'juanpozog06@gmail.com',
     'marinahg945@gmail.com',
     'marinahg@gmail.com',
     'javierpozog10@gmail.com',
     'juanpozocelta@gmail.com'
   );

-- PASO 2: Verificar que todos los usuarios correctos estén verificados
SELECT 
  id,
  email,
  full_name,
  email_verified,
  created_at
FROM users
ORDER BY created_at DESC;

-- PASO 3: Solo antonalfretdosanchez debe tener email_verified = false
-- (si existe y es una cuenta de prueba)
