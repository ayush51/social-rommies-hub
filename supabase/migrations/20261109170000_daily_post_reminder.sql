-- Nightly 9pm (household time) nudge to roommates who haven't posted their Daily photo today.
-- Picked up automatically by enqueue_reminders_all(); unique (kind, ref) makes it fire once per household per day.
-- p_now is a parameter only so tests can fix the clock.
create function public.enqueue_daily_post_reminders(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; c int; h record; who uuid[]; today date;
begin
  for h in select id, timezone from public.households loop
    continue when (p_now at time zone h.timezone)::time < time '21:00' or (p_now at time zone h.timezone)::time >= time '21:30';
    today := (p_now at time zone h.timezone)::date;
    who := array(select m.user_id from public.household_members m where m.household_id = h.id
                 and not exists (select 1 from public.daily_posts d where d.user_id = m.user_id and d.local_date = today));
    if cardinality(who) > 0 then
      insert into public.reminder_outbox (kind, ref, household_id, title, body, url, recipients)
      values ('daily_post', h.id || ':' || today, h.id, 'The Couch', 'You haven''t posted your Daily photo yet. Post before the day ends.', '/daily', who)
      on conflict (kind, ref) do nothing;
      get diagnostics c = row_count; n := n + c;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.enqueue_daily_post_reminders from public, anon, authenticated;
