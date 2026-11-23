-- Tabla de tokens de notificaciones push por dispositivo
create table if not exists public.notification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  platform text check (platform in ('ios','android','web')) not null,
  device_id text,
  enabled boolean default true,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.notification_tokens enable row level security;

-- RLS: cada usuario gestiona solo sus tokens
drop policy if exists "Users can manage own tokens" on public.notification_tokens;
create policy "Users can manage own tokens"
  on public.notification_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Índices útiles
create index if not exists idx_notification_tokens_user on public.notification_tokens(user_id);
create index if not exists idx_notification_tokens_enabled on public.notification_tokens(enabled);
