-- Rolled back. Needs seeded household (Eastern). Checks window, recipients, once-per-day.
do $$
declare hid uuid; tz text; n int; r uuid[]; poster uuid; d date; t9 timestamptz; t8 timestamptz;
begin
  select id, timezone into hid, tz from public.households limit 1;
  d := (now() at time zone tz)::date;   -- a trigger stamps posts with today's date
  t9 := (d + time '21:05') at time zone tz;
  t8 := (d + time '20:05') at time zone tz;
  delete from public.daily_posts where household_id = hid and local_date = d;
  select user_id into poster from public.household_members where household_id = hid limit 1;
  insert into public.daily_posts (household_id, user_id, local_date, photo_path) values (hid, poster, d, 'x/y.jpg');
  delete from public.reminder_outbox where kind = 'daily_post';

  if public.enqueue_daily_post_reminders(t8) <> 0 then raise exception 'fired outside the 9pm window'; end if;
  if public.enqueue_daily_post_reminders(t9) <> 1 then raise exception 'did not fire at 9pm'; end if;
  select recipients into r from public.reminder_outbox where kind = 'daily_post' and ref = hid || ':' || d;
  if poster = any(r) then raise exception 'poster was reminded'; end if;
  if cardinality(r) <> (select count(*) from public.household_members where household_id = hid) - 1 then raise exception 'wrong recipients'; end if;
  if public.enqueue_daily_post_reminders(t9 + interval '10 minutes') <> 0 then raise exception 'fired twice in one day'; end if;
  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
