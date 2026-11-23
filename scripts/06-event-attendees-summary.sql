-- Function: get_event_attendees_summary
-- Dev: Crea un resumen de asistentes por evento con top por nº de amigos
-- Nota RLS: SECURITY DEFINER para poder calcular friend_count pese a RLS en friendships

create or replace function public.get_event_attendees_summary(
  p_event_id uuid,
  p_limit int default 4
)
returns table (
  total_count int,
  top_attendees jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  avatars jsonb;
begin
  -- Total de asistentes visibles con estado 'going'
  select count(*) into total_count
  from event_attendees ea
  where ea.event_id = p_event_id
    and ea.status = 'going'
    and ea.is_visible = true;

  -- Top asistentes ordenados por nº de amigos (friend_count)
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'full_name', u.full_name,
    'avatar_url', u.avatar_url,
    'friend_count', coalesce(fc.friend_count, 0)
  )), '[]'::jsonb) into avatars
  from (
    select ea.user_id
    from event_attendees ea
    where ea.event_id = p_event_id
      and ea.status = 'going'
      and ea.is_visible = true
  ) a
  join users u on u.id = a.user_id
  left join (
    select x.user_id, count(*) as friend_count
    from (
      select user_id as user_id from friendships where status = 'accepted'
      union all
      select friend_id as user_id from friendships where status = 'accepted'
    ) x
    group by x.user_id
  ) fc on fc.user_id = u.id
  order by coalesce(fc.friend_count, 0) desc nulls last, u.full_name asc
  limit p_limit;

  return query select total_count, avatars;
end;
$$;

-- Permisos de ejecución para roles públicos de Supabase
grant execute on function public.get_event_attendees_summary(uuid, int) to anon, authenticated;
