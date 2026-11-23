-- Script 43: Policies RLS para que todo funcione como esperas
-- Objetivo:
-- 1) Permitir que cualquier usuario autenticado vea venues aprobados
-- 2) Permitir que cada usuario vea sus follows en venue_followers
-- 3) Permitir que el dueño de un venue vea a sus seguidores (select sobre venue_followers)
-- 4) Permitir seguir/dejar de seguir (insert/delete) por el propio usuario

-- Nota: Ejecutar en el SQL editor de Supabase.

BEGIN;

-- 1) venue_applications: lectura pública para aprobados + lectura para dueño
ALTER TABLE public.venue_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_approved_venues_or_own" ON public.venue_applications;
CREATE POLICY "read_approved_venues_or_own" ON public.venue_applications
FOR SELECT TO authenticated
USING (
  status = 'approved' OR user_id = auth.uid()
);

-- 2) venue_followers: políticas básicas
ALTER TABLE public.venue_followers ENABLE ROW LEVEL SECURITY;

-- Ver mis propios follows
DROP POLICY IF EXISTS "read_own_follows" ON public.venue_followers;
CREATE POLICY "read_own_follows" ON public.venue_followers
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Seguir (insert) por el propio usuario
DROP POLICY IF EXISTS "insert_own_follow" ON public.venue_followers;
CREATE POLICY "insert_own_follow" ON public.venue_followers
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Dejar de seguir (delete) por el propio usuario
DROP POLICY IF EXISTS "delete_own_follow" ON public.venue_followers;
CREATE POLICY "delete_own_follow" ON public.venue_followers
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 3) El dueño del venue puede ver a sus seguidores
DROP POLICY IF EXISTS "venue_owner_can_read_followers" ON public.venue_followers;
CREATE POLICY "venue_owner_can_read_followers" ON public.venue_followers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.venue_applications va
    WHERE va.id = venue_followers.venue_id
      AND va.user_id = auth.uid()
  )
);

COMMIT;
