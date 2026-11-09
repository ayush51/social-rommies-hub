-- Location sharing: privacy, precision, expiry/pause, rate limit. Fully rolled back (raises at the end).
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); o uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  denied boolean; r record; ok boolean; exp1 timestamptz;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,o]) u;
  insert into public.households (id, name, timezone, starting_balance) values (h1, 'H1', 'UTC', 500), (h2, 'H2', 'UTC', 500);
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h2, o, 'admin');

  -- default: nothing shared (the test users have no rows)
  if exists (select 1 from public.location_shares where user_id in (a, b, o)) then raise exception 'FAIL: rows exist by default'; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'location_shares') then
    raise exception 'FAIL: not in realtime publication';
  end if;

  -- A starts sharing
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.location_share(42.36, -71.06, 10, 'approx', 30); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: 30 minutes accepted'; end if;
  denied := false; begin perform public.location_share(91, -71.06, 10, 'approx', 60); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: lat 91 accepted'; end if;
  denied := false; begin perform public.location_share(42.36, 181, 10, 'approx', 60); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: lng 181 accepted'; end if;
  denied := false; begin perform public.location_share(42.36, -71.06, 10, 'exact', 60); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: bad precision accepted'; end if;
  if (select count(*) from public.location_shares where user_id = a) <> 0 then raise exception 'FAIL: rejected calls left rows'; end if;
  denied := false; begin insert into public.location_shares (user_id, household_id, precision, lat, lng, expires_at) values (a, h1, 'precise', 1, 1, now() + interval '1 day'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct insert allowed'; end if;

  exp1 := public.location_share(42.361234, -71.067891, 5, 'approx', 60);
  select * into r from public.location_shares where user_id = a;
  if r.lat <> 42.36 or r.lng <> -71.07 then raise exception 'FAIL: approx not rounded (% %)', r.lat, r.lng; end if;
  if r.accuracy_m < 1000 then raise exception 'FAIL: approx accuracy leaks precision'; end if;
  if r.expires_at < now() + interval '59 minutes' or r.expires_at > now() + interval '61 minutes' then raise exception 'FAIL: expiry wrong'; end if;
  exp1 := public.location_share(42.361234, -71.067891, 5, 'precise', 15);
  select * into r from public.location_shares where user_id = a;
  if r.lat <> 42.36123 or r.lng <> -71.06789 then raise exception 'FAIL: precise not 5 decimals (% %)', r.lat, r.lng; end if;
  if (select count(*) from public.location_shares where user_id = a) <> 1 then raise exception 'FAIL: more than one row per user'; end if;
  exp1 := public.location_share(42.361234, -71.067891, 5, 'precise', 60);   -- extend

  -- direct writes denied even on own row
  denied := false; begin update public.location_shares set expires_at = now() + interval '30 days' where user_id = a; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct update allowed'; end if;
  denied := false; begin delete from public.location_shares where user_id = a; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct delete allowed'; end if;
  denied := false; begin perform public.location_round(1, 'approx'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: internal helper callable'; end if;
  reset role;

  -- visibility: housemate sees active, outsider sees nothing
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if (select count(*) from public.location_shares where user_id = a) <> 1 then raise exception 'FAIL: housemate cannot see active share'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if (select count(*) from public.location_shares where user_id = a) <> 0 then raise exception 'FAIL: outsider sees a share'; end if;
  if public.location_update(1, 1, 1) then raise exception 'FAIL: update without a share accepted'; end if;
  reset role;
  if exists (select 1 from public.location_shares where user_id = o) then raise exception 'FAIL: outsider update created a row'; end if;

  -- rate limit: update right after share is refused; after 21s it works; again immediately refused
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := public.location_update(40.123456, -70.123456, 8);
  if ok then raise exception 'FAIL: update within 20s accepted'; end if;
  reset role;
  update public.location_shares set updated_at = now() - interval '21 seconds' where user_id = a;
  set local role authenticated;
  ok := public.location_update(40.123456, -70.123456, 8);
  if not ok then raise exception 'FAIL: update after 21s refused'; end if;
  select * into r from public.location_shares where user_id = a;
  if r.lat <> 40.12346 or r.lng <> -70.12346 then raise exception 'FAIL: update not rounded to precise (% %)', r.lat, r.lng; end if;
  if r.expires_at <> exp1 then raise exception 'FAIL: update changed expiry'; end if;
  if public.location_update(41, -70, 8) then raise exception 'FAIL: second quick update accepted'; end if;
  reset role;
  update public.location_shares set updated_at = now() - interval '21 seconds' where user_id = a;
  set local role authenticated;
  denied := false; begin perform public.location_update(41, 200, 8); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: update with bad lng accepted'; end if;

  -- pause hides from housemate, not owner; updates stop; resume restores
  perform public.location_pause(true);
  if (select count(*) from public.location_shares where user_id = a) <> 1 then raise exception 'FAIL: owner cannot see paused share'; end if;
  if public.location_update(10, 10, 1) then raise exception 'FAIL: update while paused accepted'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if (select count(*) from public.location_shares where user_id = a) <> 0 then raise exception 'FAIL: housemate sees paused share'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.location_pause(false);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if (select count(*) from public.location_shares where user_id = a) <> 1 then raise exception 'FAIL: resume did not restore visibility'; end if;
  reset role;

  -- expiry: hidden from housemate, visible to owner, updates and un-pause do nothing
  update public.location_shares set expires_at = now() - interval '1 minute', updated_at = now() - interval '5 minutes' where user_id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if (select count(*) from public.location_shares where user_id = a) <> 0 then raise exception 'FAIL: housemate sees expired share'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if (select count(*) from public.location_shares where user_id = a) <> 1 then raise exception 'FAIL: owner cannot see expired row'; end if;
  if public.location_update(10, 10, 1) then raise exception 'FAIL: update after expiry accepted'; end if;
  perform public.location_pause(true);
  perform public.location_pause(false);
  reset role;
  if (select expires_at from public.location_shares where user_id = a) > now() then raise exception 'FAIL: pause/resume revived expired share'; end if;

  -- purge: only rows expired over an hour ago; clients cannot run it
  insert into public.location_shares (user_id, household_id, precision, lat, lng, expires_at, updated_at)
    values (b, h1, 'approx', 1, 1, now() - interval '2 hours', now() - interval '3 hours');
  denied := false;
  set local role authenticated;
  begin perform public.enqueue_location_reminders(); exception when others then denied := true; end;
  reset role;
  if not denied then raise exception 'FAIL: clients can run the purge'; end if;
  if public.enqueue_location_reminders() <> 0 then raise exception 'FAIL: purge should return 0'; end if;
  if exists (select 1 from public.location_shares where user_id = b) then raise exception 'FAIL: old row not purged'; end if;
  if not exists (select 1 from public.location_shares where user_id = a) then raise exception 'FAIL: recent expired row purged too early'; end if;

  -- stop deletes
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.location_share(1.5, 2.5, null, 'precise', 15);
  perform public.location_stop();
  if (select count(*) from public.location_shares where user_id = a) <> 0 then raise exception 'FAIL: stop did not delete'; end if;
  reset role;

  -- anonymous cannot call
  set local role anon;
  denied := false; begin perform public.location_stop(); exception when others then denied := true; end;
  reset role;
  if not denied then raise exception 'FAIL: anon can call location_stop'; end if;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
