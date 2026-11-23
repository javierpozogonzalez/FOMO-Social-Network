-- Functions to compute social metrics bypassing RLS safely
-- SECURITY DEFINER so that counts and mutuals can be computed without exposing raw friendships indiscriminately

-- 1) Return friend counts for a list of user ids
create or replace function public.get_users_friend_counts(user_ids_param uuid[])
returns table (
  user_id uuid,
  friend_count int
)
language sql
security definer
set search_path = public
as $$
  with all_edges as (
    -- Normaliza las aristas a (user_id, friend_id) sin duplicados aunque existan filas en ambos sentidos
    -- Solo cuenta si AMBAS direcciones existen (amistad bidireccional válida)
    select f1.user_id, f1.friend_id 
    from friendships f1
    where f1.status = 'accepted'
    and exists (
      select 1 from friendships f2 
      where f2.user_id = f1.friend_id 
      and f2.friend_id = f1.user_id 
      and f2.status = 'accepted'
    )
  ), dedup as (
    -- Deduplicación explícita de cada relación
    select distinct user_id, friend_id from all_edges
  )
  select e.user_id, count(*)::int as friend_count
  from dedup e
  where e.user_id = any(user_ids_param)
  group by e.user_id;
$$;

grant execute on function public.get_users_friend_counts(uuid[]) to anon, authenticated;

-- 2) Return mutual friends (basic fields) between two users
create or replace function public.get_mutual_friends(user_a uuid, user_b uuid, limit_param int default 25)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  city text
)
language sql
security definer
set search_path = public
as $$
  with edges as (
    -- Normaliza y deduplica las aristas de amistad
    -- Solo considera amistades bidireccionales válidas
    select f1.user_id, f1.friend_id 
    from friendships f1
    where f1.status = 'accepted'
    and exists (
      select 1 from friendships f2 
      where f2.user_id = f1.friend_id 
      and f2.friend_id = f1.user_id 
      and f2.status = 'accepted'
    )
  ),
  a_friends as (
    -- Lista deduplicada de amigos de A
    select distinct friend_id from edges where user_id = user_a
  ),
  b_friends as (
    -- Lista deduplicada de amigos de B
    select distinct friend_id from edges where user_id = user_b
  ),
  mutual as (
    -- Amigos en común deduplicados
    select distinct a.friend_id as id from a_friends a inner join b_friends b on a.friend_id = b.friend_id
  )
  select distinct u.id, u.full_name, u.avatar_url, u.city
  from mutual m
  join users u on u.id = m.id
  limit limit_param;
$$;

grant execute on function public.get_mutual_friends(uuid, uuid, int) to anon, authenticated;

-- 3) Friend suggestions (2º grado) para un usuario
-- Devuelve usuarios que son amigos de tus amigos pero no son tus amigos ni tienen solicitud pendiente
-- Incluye mutual_count para ordenar por relevancia
create or replace function public.get_friend_suggestions(p_user uuid, limit_param int default 20)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  city text,
  mutual_count int
)
language sql
security definer
set search_path = public
as $$
  with edges as (
    -- Solo amistades bidireccionales válidas
    select f1.user_id, f1.friend_id
    from friendships f1
    where f1.status = 'accepted'
      and exists (
        select 1 from friendships f2
        where f2.user_id = f1.friend_id
          and f2.friend_id = f1.user_id
          and f2.status = 'accepted'
      )
  ),
  direct as (
    select distinct friend_id from edges where user_id = p_user
  ),
  second_hops as (
    -- Para cada amigo directo, trae sus amigos
    select e.user_id as mutual_id, e.friend_id as candidate_id
    from edges e
    where e.user_id in (select friend_id from direct)
      and e.friend_id <> p_user
  ),
  candidates as (
    -- Candidatos deduplicados excluyendo amigos directos y el propio usuario
    select distinct candidate_id
    from second_hops
    where candidate_id not in (select friend_id from direct)
      and candidate_id <> p_user
  ),
  filtered as (
    -- Excluir quienes ya tengan relación pendiente en cualquier dirección
    select c.candidate_id
    from candidates c
    where not exists (
      select 1 from friendships f
      where (
        (f.user_id = p_user and f.friend_id = c.candidate_id) or
        (f.user_id = c.candidate_id and f.friend_id = p_user)
      ) and f.status in ('pending', 'accepted')
    )
  ),
  mutuals as (
    -- Contar cuántos amigos directos en común conectan con cada candidato
    select s.candidate_id, count(*)::int as mutual_count
    from second_hops s
    where s.candidate_id in (select candidate_id from filtered)
    group by s.candidate_id
  )
  select u.id, u.full_name, u.avatar_url, u.city, coalesce(m.mutual_count, 0) as mutual_count
  from filtered f
  join users u on u.id = f.candidate_id
  left join mutuals m on m.candidate_id = u.id
  order by mutual_count desc, u.full_name asc
  limit limit_param;
$$;

grant execute on function public.get_friend_suggestions(uuid, int) to anon, authenticated;
