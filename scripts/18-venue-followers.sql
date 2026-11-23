-- Tabla para seguimiento unidireccional de venues
-- Un usuario puede seguir un venue (nombre), pero el venue no sigue al usuario
-- Permite categorizar en: Frecuentes, Favoritos, Recientes

create table if not exists public.venue_followers (
  user_id uuid references public.users(id) on delete cascade,
  venue_name text not null, -- Nombre del venue (ej: "Fabrik", "Teatro Kapital")
  city text not null, -- Ciudad del venue
  followed_at timestamptz not null default now(),
  notifications_enabled boolean not null default true,
  is_favorite boolean not null default false, -- Marcado manualmente como favorito
  primary key (user_id, venue_name, city)
);

-- Índices para queries eficientes
create index if not exists idx_venue_followers_user on public.venue_followers(user_id);
create index if not exists idx_venue_followers_venue on public.venue_followers(venue_name, city);
create index if not exists idx_venue_followers_favorite on public.venue_followers(user_id, is_favorite) where is_favorite = true;

-- RLS policies
alter table public.venue_followers enable row level security;

-- Eliminar policies existentes si existen
drop policy if exists "Users can view own venue follows" on public.venue_followers;
drop policy if exists "Users can follow venues" on public.venue_followers;
drop policy if exists "Users can update own venue follows" on public.venue_followers;
drop policy if exists "Users can unfollow venues" on public.venue_followers;

-- Los usuarios pueden ver sus propios follows
create policy "Users can view own venue follows"
  on public.venue_followers for select
  using (auth.uid() = user_id);

-- Los usuarios pueden insertar sus propios follows
create policy "Users can follow venues"
  on public.venue_followers for insert
  with check (auth.uid() = user_id);

-- Los usuarios pueden actualizar sus propios follows
create policy "Users can update own venue follows"
  on public.venue_followers for update
  using (auth.uid() = user_id);

-- Los usuarios pueden borrar sus propios follows
create policy "Users can unfollow venues"
  on public.venue_followers for delete
  using (auth.uid() = user_id);

-- Función para obtener estadísticas de venues de un usuario
-- Categoriza en: Frecuentes (más eventos asistidos), Favoritos (marcados), Recientes (últimos 30 días)
create or replace function public.get_user_venue_stats(p_user_id uuid)
returns table (
  venue_name text,
  city text,
  category text, -- 'frequent' | 'favorite' | 'recent'
  events_attended int,
  is_following boolean,
  is_favorite boolean,
  next_event_id uuid,
  next_event_name text,
  next_event_date timestamptz,
  friends_following_count int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with user_venues as (
    -- Venues donde el usuario ha asistido a eventos
    select 
      e.venue_name,
      e.city,
      count(distinct ea.event_id)::int as events_attended,
      max(e.event_date) as last_attended
    from events e
    inner join event_attendees ea on ea.event_id = e.id
    where ea.user_id = p_user_id 
      and ea.status = 'going'
      and e.event_date <= now() -- Solo eventos pasados o en curso
    group by e.venue_name, e.city
  ),
  user_follows as (
    -- Venues que el usuario sigue
    select venue_name, city, is_favorite, followed_at
    from venue_followers
    where user_id = p_user_id
  ),
  next_events as (
    -- Próximo evento de cada venue
    select distinct on (e.venue_name, e.city)
      e.venue_name,
      e.city,
      e.id as event_id,
      e.title as event_name,
      e.event_date
    from events e
    where e.event_date >= now()
    order by e.venue_name, e.city, e.event_date asc
  ),
  friends_counts as (
    -- Cuántos amigos siguen cada venue
    select 
      vf.venue_name as fc_venue_name,
      vf.city as fc_city,
      count(distinct vf.user_id)::int as friends_count
    from venue_followers vf
    where vf.user_id in (
      -- Amigos del usuario (bidireccionales)
      select f1.friend_id 
      from friendships f1
      where f1.user_id = p_user_id 
        and f1.status = 'accepted'
        and exists (
          select 1 from friendships f2 
          where f2.user_id = f1.friend_id 
            and f2.friend_id = p_user_id 
            and f2.status = 'accepted'
        )
    )
    group by vf.venue_name, vf.city
  ),
  categorized as (
    select 
      uv.venue_name,
      uv.city,
      case 
        when uf.is_favorite = true then 'favorite'
        when uv.events_attended >= 3 then 'frequent'
        when uv.last_attended >= now() - interval '30 days' then 'recent'
        else 'other'
      end as category,
      uv.events_attended,
      (uf.venue_name is not null) as is_following,
      coalesce(uf.is_favorite, false) as is_favorite,
      ne.event_id as next_event_id,
      ne.event_name as next_event_name,
      ne.event_date as next_event_date,
      coalesce(fc.friends_count, 0) as friends_following_count
    from user_venues uv
    left join user_follows uf on uf.venue_name = uv.venue_name and uf.city = uv.city
    left join next_events ne on ne.venue_name = uv.venue_name and ne.city = uv.city
    left join friends_counts fc on fc.fc_venue_name = uv.venue_name and fc.fc_city = uv.city
  )
  select * from categorized
  where category in ('frequent', 'favorite', 'recent')
  order by 
    case category
      when 'favorite' then 1
      when 'frequent' then 2
      when 'recent' then 3
    end,
    events_attended desc,
    venue_name asc;
end;
$$;

grant execute on function public.get_user_venue_stats(uuid) to anon, authenticated;

-- Función para obtener el conteo de followers de un venue
create or replace function public.get_venue_follower_count(p_venue_name text, p_city text)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from venue_followers
  where venue_name = p_venue_name and city = p_city;
$$;

grant execute on function public.get_venue_follower_count(text, text) to anon, authenticated;
