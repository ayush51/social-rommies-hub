-- Rally: server-validated, rate-limited, push-only (no chat message).
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  r1 uuid; n int; denied boolean; t record;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name) values (h1, 'H1'), (h2, 'H2');
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth)
    values (a, h1, 'ep-a', 'k', 'a'), (b, h1, 'ep-b', 'k', 'a'), (c, h2, 'ep-c', 'k', 'a');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.start_rally('   '); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: blank rally accepted'; end if;
  denied := false; begin perform public.start_rally(repeat('x', 61)); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: overlong rally accepted'; end if;
  r1 := public.start_rally('Gaming');
  denied := false; begin perform public.start_rally('Movie'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: rally spam not rate-limited'; end if;
  denied := false; begin insert into public.rallies (household_id, user_id, label) values (h1, a, 'direct'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct rally insert allowed'; end if;
  select count(*) into n from public.push_targets('rally', r1);
  if n <> 1 then raise exception 'FAIL: rally should reach exactly the housemate device (B), got %', n; end if;
  select count(*) into n from public.push_targets('rally', r1);
  if n <> 0 then raise exception 'FAIL: rally pushed twice'; end if;
  select count(*) into n from public.messages;
  if n <> 0 then raise exception 'FAIL: rally created a chat message'; end if;
  reset role;

  -- text of the push, and that others cannot trigger it
  delete from public.push_log;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.push_targets('rally', r1);
  if n <> 0 then raise exception 'FAIL: non-author triggered a rally push'; end if;
  select count(*) into n from public.rallies;
  if n <> 1 then raise exception 'FAIL: housemate should see the rally row'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into t from public.push_targets('rally', r1) limit 1;
  if t.body <> 'Gaming. Who''s in?' or t.url <> '/' then raise exception 'FAIL: push text %', t.body; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.rallies;
  if n <> 0 then raise exception 'FAIL: outsider sees H1 rallies'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
