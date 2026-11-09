-- Generic push events, secret helper, reminder dispatcher.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); ev uuid; ev2 uuid; n int; denied boolean; r int;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name) values (h1, 'H1');
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h1, c, 'member');
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth)
    values (a, h1, 'ep-a', 'k', 'a'), (b, h1, 'ep-b', 'k', 'a'), (c, h1, 'ep-c', 'k', 'a');

  ev := public.emit_push_event(h1, a, 'pets', 'Mae is hungry', 'Feed her', '/pets');
  ev2 := public.emit_push_event(h1, a, 'chess', 'Your move', 'vs Ayush', '/games/chess/x', b);

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.emit_push_event(h1, a, 'x', 't', 'b', '/'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: clients can emit push events directly'; end if;
  denied := false; begin perform count(*) from public.push_events; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: push_events readable by clients'; end if;
  select count(*) into n from public.push_targets('event', ev);
  if n <> 2 then raise exception 'FAIL: house event should reach the 2 housemates, got %', n; end if;
  select count(*) into n from public.push_targets('event', ev);
  if n <> 0 then raise exception 'FAIL: event notified twice'; end if;
  select count(*) into n from public.push_targets('event', ev2);
  if n <> 1 then raise exception 'FAIL: targeted event should reach only B, got %', n; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.push_targets('event', ev);
  if n <> 0 then raise exception 'FAIL: non-actor triggered an event push'; end if;
  reset role;

  update public.push_events set created_at = now() - interval '1 hour' where id = ev;
  delete from public.push_log;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.push_targets('event', ev);
  if n <> 0 then raise exception 'FAIL: stale event notified'; end if;
  reset role;

  -- secret helper
  perform vault.create_secret('probe-value', 'zz_probe_secret');
  if not private.secret_ok('zz_probe_secret', 'probe-value') then raise exception 'FAIL: right secret rejected'; end if;
  if private.secret_ok('zz_probe_secret', 'wrong') or private.secret_ok('zz_probe_secret', null) or private.secret_ok('nope', 'probe-value') then raise exception 'FAIL: wrong/null/unknown secret accepted'; end if;

  -- dispatcher runs any zero-arg enqueue_*_reminders() function automatically
  create function public.enqueue_zztest_reminders() returns int language plpgsql security definer set search_path = '' as $f$
  declare c int;
  begin
    insert into public.reminder_outbox (kind, ref, household_id, title, body, url, recipients)
    values ('zztest', 'r1', (select id from public.households limit 1), 't', 'b', '/', '{}') on conflict do nothing;
    get diagnostics c = row_count; return c;
  end $f$;
  r := public.enqueue_reminders_all();
  if not exists (select 1 from public.reminder_outbox where kind = 'zztest') then raise exception 'FAIL: dispatcher did not run the feature reminder function'; end if;
  if public.enqueue_reminders_all() <> 0 then raise exception 'FAIL: dispatcher re-queued reminders'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.enqueue_reminders_all(); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: clients can run the dispatcher'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
