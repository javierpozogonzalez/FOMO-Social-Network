-- Crea bucket para imágenes de eventos y políticas básicas
-- Ejecutar en Supabase SQL
-- Ajustar dominio del CDN si se activa posteriormente

-- Crear bucket si no existe
insert into storage.buckets (id, name, public) values ('event-images', 'event-images', true)
on conflict (id) do nothing;

-- Política: permitir lectura pública (listado/descarga)
do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename  = 'objects'
			and policyname = 'Public read event images'
	) then
		create policy "Public read event images"
		on storage.objects for select
		using ( bucket_id = 'event-images' );
	end if;
end$$;

-- Política: permitir subida al dueño autenticado (cualquier usuario logueado)
do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename  = 'objects'
			and policyname = 'Authenticated upload event images'
	) then
		create policy "Authenticated upload event images"
		on storage.objects for insert
		to authenticated
		with check ( bucket_id = 'event-images' );
	end if;
end$$;

-- Política: permitir actualización sólo del que subió
do $$
begin
	if not exists (
		select 1 from pg_policies
		where schemaname='storage' and tablename='objects' and policyname='Owner modify event images'
	) then
		create policy "Owner modify event images"
		on storage.objects for update
		to authenticated
		using (bucket_id = 'event-images' and owner = auth.uid())
		with check (bucket_id = 'event-images' and owner = auth.uid());
	end if;
end$$;

-- Política: permitir eliminación sólo del que subió
do $$
begin
	if not exists (
		select 1 from pg_policies
		where schemaname='storage' and tablename='objects' and policyname='Owner delete event images'
	) then
		create policy "Owner delete event images"
		on storage.objects for delete
		to authenticated
		using (bucket_id = 'event-images' and owner = auth.uid());
	end if;
end$$;

-- NOTA: El campo owner lo gestiona Supabase automáticamente si viene el JWT
