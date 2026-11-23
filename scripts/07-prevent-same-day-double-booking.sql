-- Prevent the same user from joining two events on the same day
create or replace function public.prevent_same_day_double_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date date;
  v_exists boolean;
begin
  -- Only enforce when marking as 'going'
  if NEW.status <> 'going' then
    return NEW;
  end if;

  -- Get the date of the target event
  select e.event_date into v_event_date from events e where e.id = NEW.event_id;

  -- If no date found, allow (shouldn't happen if FK is good)
  if v_event_date is null then
    return NEW;
  end if;

  -- Check if there's already another 'going' event the same day for this user
  select exists (
    select 1
    from event_attendees ea
    join events ev on ev.id = ea.event_id
    where ea.user_id = NEW.user_id
      and ea.status = 'going'
      and ev.event_date = v_event_date
      and ea.event_id <> NEW.event_id
  ) into v_exists;

  if v_exists then
    raise exception 'Ya estás apuntado a otro evento el mismo día';
  end if;

  return NEW;
end;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_no_double_booking ON public.event_attendees;
create trigger trg_no_double_booking
before insert or update on public.event_attendees
for each row
execute function public.prevent_same_day_double_booking();
