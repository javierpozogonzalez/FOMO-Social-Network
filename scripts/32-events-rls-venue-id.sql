-- Políticas RLS para permitir que un local cree/edite sus eventos usando venue_id
-- Ejecutar en Supabase SQL

-- Asegura que RLS está habilitado (si ya lo está, no pasa nada)
alter table public.events enable row level security;

-- Política de SELECT (todos pueden ver eventos públicos)
create policy if not exists "Events are viewable by everyone"
  on public.events for select
  using ( true );

-- Política de INSERT: el usuario autenticado debe tener un venue_id y coincidir con events.venue_id
create policy if not exists "Venue can insert own events"
  on public.events for insert
  to authenticated
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.venue_id is not null
        and u.venue_id = events.venue_id
    )
  );

-- Política de UPDATE: sólo si el evento pertenece al venue del usuario
create policy if not exists "Venue can update own events"
  on public.events for update
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.venue_id is not null
        and u.venue_id = events.venue_id
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.venue_id is not null
        and u.venue_id = events.venue_id
    )
  );

-- (Opcional) Política de DELETE: sólo el mismo venue
create policy if not exists "Venue can delete own events"
  on public.events for delete
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.venue_id is not null
        and u.venue_id = events.venue_id
    )
  );
