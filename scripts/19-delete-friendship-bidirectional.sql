-- Bidirectional friendship delete with SECURITY DEFINER
-- Ensures that when a user removes a friend, both directions are deleted in a single, authorized operation.
-- Usage: select public.delete_friendship_bidirectional('user_a_uuid', 'user_b_uuid');

create or replace function public.delete_friendship_bidirectional(user_a uuid, user_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only allow one of the two users involved to perform this action
  if auth.uid() is null or (auth.uid() <> user_a and auth.uid() <> user_b) then
    raise exception 'not authorized';
  end if;

  -- Delete ALL friendship records between these two users (pending, accepted, rejected)
  -- This ensures complete cleanup regardless of status
  delete from public.friendships
  where (user_id = user_a and friend_id = user_b)
     or (user_id = user_b and friend_id = user_a);
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.delete_friendship_bidirectional(uuid, uuid) to authenticated;
