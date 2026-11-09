-- Unread chat, message edits, notification prefs + quiet hours, birthdays.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); e uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  m1 uuid; mold uuid; j jsonb; n int; denied boolean; sec text; ev uuid;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,e,c]) u;
  insert into public.households (id, name, timezone) values (h1, 'H1', 'UTC'), (h2, 'H2', 'UTC');
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h1, e, 'member'), (h2, c, 'admin');
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth)
    values (a, h1, 'ep-a', 'k', 'a'), (b, h1, 'ep-b', 'k', 'a'), (e, h1, 'ep-e', 'k', 'a');

  -- ---- unread: first sight is "read"; then new messages count
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (household_id, user_id, body) values (h1, a, 'old history');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.chat_unread();
  if (j->>'total')::int <> 0 then raise exception 'FAIL: history should not be unread on first sight: %', j; end if;
  reset role;
  perform pg_sleep(0.05);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (household_id, user_id, body, created_at) values (h1, a, 'group hello', clock_timestamp()), (h1, a, 'group again', clock_timestamp());
  insert into public.messages (household_id, user_id, recipient_id, body, created_at) values (h1, a, b, 'dm to b', clock_timestamp());
  insert into public.messages (household_id, user_id, recipient_id, body, created_at) values (h1, a, e, 'dm to e', clock_timestamp());
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.chat_unread();
  if (j->>'group')::int <> 2 or (j->'dms'->>a::text)::int <> 1 or (j->>'total')::int <> 3 then raise exception 'FAIL: B unread wrong: %', j; end if;
  if j->'dms' ? e::text then raise exception 'FAIL: B sees an unread count for a DM that is not theirs'; end if;
  perform public.mark_chat_read('group');
  j := public.chat_unread();
  if (j->>'group')::int <> 0 or (j->>'total')::int <> 1 then raise exception 'FAIL: marking group read: %', j; end if;
  perform public.mark_chat_read(a::text);
  if (public.chat_unread()->>'total')::int <> 0 then raise exception 'FAIL: marking DM read'; end if;
  denied := false; begin perform public.mark_chat_read(c::text); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: marked an outsider thread'; end if;
  denied := false; begin insert into public.chat_reads (user_id, thread) values (b, 'x'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct chat_reads write allowed'; end if;
  -- own messages never count as unread
  insert into public.messages (household_id, user_id, body, created_at) values (h1, b, 'my own message', clock_timestamp());
  if (public.chat_unread()->>'group')::int <> 0 then raise exception 'FAIL: own message counted unread'; end if;
  reset role;

  -- ---- edits
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (household_id, user_id, body) values (h1, b, 'typo here') returning id into m1;
  update public.messages set body = 'fixed' where id = m1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: could not edit own message'; end if;
  if (select edited_at from public.messages where id = m1) is null then raise exception 'FAIL: edited_at not set'; end if;
  denied := false; begin update public.messages set recipient_id = a where id = m1; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: changed recipient via edit'; end if;
  denied := false; begin update public.messages set user_id = a where id = m1; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: changed author via edit'; end if;
  denied := false; begin update public.messages set body = '' where id = m1; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: emptied a text message'; end if;
  update public.messages set body = 'hacked' where body = 'group hello';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: edited someone else''s message'; end if;
  reset role;
  insert into public.messages (household_id, user_id, body, created_at) values (h1, b, 'ancient', now() - interval '2 hours') returning id into mold;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin update public.messages set body = 'late edit' where id = mold; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: edited a message older than an hour'; end if;
  reset role;

  -- ---- preferences: muted category and quiet hours filter push + reminders
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.set_notification_prefs(array['bogus'], null, null); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: unknown category accepted'; end if;
  denied := false; begin perform public.set_notification_prefs(array[]::text[], '22:00', null); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: half a quiet window accepted'; end if;
  perform public.set_notification_prefs(array['plans'], null, null);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.plans (household_id, created_by, title, starts_at) values (h1, a, 'Pizza', now() + interval '1 day') returning id into m1;
  select count(*) into n from public.push_targets('plan', m1);
  if n <> 1 then raise exception 'FAIL: muted plans should leave only B (got %)', n; end if;
  insert into public.messages (household_id, user_id, body) values (h1, a, 'ping') returning id into m1;
  select count(*) into n from public.push_targets('message', m1);
  if n <> 2 then raise exception 'FAIL: chat is not muted for B and E (got %)', n; end if;
  reset role;
  -- quiet hours around "now" (household timezone is UTC) silence B; a window elsewhere does not
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_notification_prefs(array[]::text[], ((now() at time zone 'UTC')::time - interval '1 hour')::time, ((now() at time zone 'UTC')::time + interval '1 hour')::time);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (household_id, user_id, body) values (h1, a, 'ping 2') returning id into m1;
  select count(*) into n from public.push_targets('message', m1);
  if n <> 1 then raise exception 'FAIL: quiet hours should silence B (got % targets)', n; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_notification_prefs(array[]::text[], ((now() at time zone 'UTC')::time + interval '3 hours')::time, ((now() at time zone 'UTC')::time + interval '5 hours')::time);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (household_id, user_id, body) values (h1, a, 'ping 3') returning id into m1;
  select count(*) into n from public.push_targets('message', m1);
  if n <> 2 then raise exception 'FAIL: a quiet window elsewhere must not silence B (got %)', n; end if;
  denied := false; begin perform public.push_allowed(b, 'chat'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: clients can call push_allowed'; end if;
  reset role;

  -- reminders respect the same preferences (E muted plans)
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'cron_secret';
  if sec is null then perform vault.create_secret('t3st-secret', 'cron_secret'); sec := 't3st-secret'; end if;
  insert into public.reminder_outbox (kind, ref, household_id, title, body, url, recipients) values ('plan_soon', 'p1', h1, 'Pizza', 'Starting soon', '/', array[b, e]);
  select count(*) into n from public.reminders_claim(sec) where true;
  if n <> 1 then raise exception 'FAIL: plan reminder should skip E (muted) and B is outside quiet hours; got % devices', n; end if;

  -- ---- birthdays (fixed clock)
  update public.profiles set dob = '1990-03-14' where id = b;
  update public.profiles set display_name = 'Bee' where id = b;
  if public.birthday_reminders_at('2026-03-14 08:00+00') <> 0 then raise exception 'FAIL: birthday reminder before 09:00'; end if;
  if public.birthday_reminders_at('2026-03-14 10:00+00') <> 1 then raise exception 'FAIL: birthday reminder not queued at 10:00'; end if;
  if public.birthday_reminders_at('2026-03-14 11:00+00') <> 0 then raise exception 'FAIL: birthday reminder queued twice'; end if;
  if public.birthday_reminders_at('2026-03-15 10:00+00') <> 0 then raise exception 'FAIL: reminder on the wrong day'; end if;
  if (select cardinality(recipients) from public.reminder_outbox where kind = 'birthday') <> 2 then raise exception 'FAIL: birthday should notify the 2 housemates'; end if;
  if (select body from public.reminder_outbox where kind = 'birthday') <> 'Bee has a birthday today' then raise exception 'FAIL: birthday text'; end if;
  if public.enqueue_birthdays_reminders() is null then raise exception 'FAIL: dispatcher wrapper'; end if;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
