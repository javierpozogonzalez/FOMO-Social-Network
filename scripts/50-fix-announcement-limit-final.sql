-- 50-fix-announcement-limit-final.sql
-- Arreglo final: asegurar que premium devuelve NULL (ilimitado) en límite de anuncios

BEGIN;

-- ============================================================================
-- 1) RECREAR get_announcement_limit_from_plan CON LÓGICA CORRECTA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_announcement_limit_from_plan(p_user_id uuid)
RETURNS int LANGUAGE plpgsql STABLE AS $$
DECLARE
  plan_info record;
BEGIN
  -- Obtener plan efectivo completo
  SELECT * INTO plan_info 
  FROM public.get_effective_venue_plan(p_user_id)
  LIMIT 1;
  
  -- Si no es venue o no tiene plan, límite 0
  IF NOT FOUND OR NOT plan_info.is_venue OR plan_info.visual_plan IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Mapear plan a límite (premium = NULL = ilimitado)
  RETURN CASE lower(plan_info.visual_plan)
    WHEN 'free' THEN 2
    WHEN 'pro' THEN 6
    WHEN 'premium' THEN NULL  -- ⭐ ILIMITADO
    ELSE 0
  END;
END $$;

-- ============================================================================
-- 2) VERIFICAR TU PLAN ACTUAL (debug)
-- ============================================================================

-- Ejecuta estas queries en orden para debuggear:

-- Query 1: Ver venue_applications
-- SELECT id, venue_name, subscription_plan, subscription_status 
-- FROM public.venue_applications 
-- WHERE id = 'b0a75185-d9f4-49fa-abad-9b1047323db1';
-- Debe mostrar: subscription_plan = 'premium', subscription_status = 'active'

-- Query 2: Ver users (sincronizado por trigger)
-- SELECT id, email, account_type, subscription_status 
-- FROM public.users 
-- WHERE id = 'e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae';
-- Debe mostrar: account_type = 'venue_premium', subscription_status = 'active'

-- Query 3: Ver plan efectivo
-- SELECT is_venue, plan, visual_plan 
-- FROM public.get_effective_venue_plan('e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae');
-- Debe mostrar: is_venue = true, plan = 'premium', visual_plan = 'premium'

-- Query 4: Ver límite de anuncios (ESTE ES EL CRÍTICO)
-- SELECT public.get_announcement_limit_from_plan('e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae') as limite;
-- Debe mostrar: limite = NULL (si muestra un número, hay problema)

-- ============================================================================
-- 3) SI AÚN DA ERROR: FORZAR ACTUALIZACIÓN MANUAL
-- ============================================================================

-- Solo ejecuta esto SI las queries anteriores muestran que tienes premium 
-- pero aún da error de límite:

-- UPDATE public.venue_applications
-- SET subscription_plan = 'premium',
--     subscription_status = 'active',
--     trial_ends_at = NULL,
--     updated_at = now()
-- WHERE id = 'b0a75185-d9f4-49fa-abad-9b1047323db1';

-- UPDATE public.users
-- SET account_type = 'venue_premium',
--     subscription_status = 'active',
--     trial_ends_at = NULL
-- WHERE id = 'e7edc1e9-dc77-47a3-93c2-7ee7776ff7ae';

COMMIT;

-- ============================================================================
-- ✅ DESPUÉS DE EJECUTAR ESTE SCRIPT
-- ============================================================================
-- 1. Recarga la app (cierra y abre, o pull to refresh)
-- 2. Ve al chat del evento
-- 3. Intenta crear un anuncio
-- 4. NO debe dar error de límite
-- 5. El anuncio debe aparecer en event_announcements
