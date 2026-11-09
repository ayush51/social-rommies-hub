-- Push: subscription isolation, who can trigger a notification, dedupe.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  ma uuid; mold uuid; n int; denied boolean;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name) values (h1, 'H1'), (h2, 'H2');
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');

  -- each user registers a device
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_subscription('https://push.example/a', 'k', 'a');
  insert into public.messages (household_id, user_id, body) values (h1, a, 'hello house') returning id into ma;
  reset role;
  insert into public.messages (household_id, user_id, body, created_at) values (h1, a, 'old', now() - interval '1 hour') returning id into mold;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_subscription('https://push.example/b', 'k', 'b');
  select count(*) into n from public.push_subscriptions;
  if n <> 1 then raise exception 'FAIL: B sees % subscriptions, expected only own', n; end if;
  denied := false; begin insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth) values (b, h1, 'x', 'k', 'a'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct subscription insert allowed'; end if;
  -- B cannot trigger a push for A's message
  select count(*) into n from public.push_targets('message', ma);
  if n <> 0 then raise exception 'FAIL: non-author triggered a push'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_subscription('https://push.example/c', 'k', 'c');
  reset role;

  -- A triggers: only housemate B's device comes back, once
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.push_targets('message', ma);
  if n <> 1 then raise exception 'FAIL: expected 1 target (B), got %', n; end if;
  select count(*) into n from public.push_targets('message', ma);
  if n <> 0 then raise exception 'FAIL: same event notified twice'; end if;
  select count(*) into n from public.push_targets('message', mold);
  if n <> 0 then raise exception 'FAIL: stale message notified'; end if;
  denied := false; begin perform public.push_targets('bogus', ma); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: unknown kind accepted'; end if;
  denied := false; begin select count(*) into n from public.push_log; if n = 0 then denied := true; end if; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: push_log readable'; end if;
  reset role;

  -- switching users on a device re-assigns the endpoint
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_subscription('https://push.example/b', 'k2', 'a2');
  select count(*) into n from public.push_subscriptions where endpoint = 'https://push.example/b';
  if n <> 1 then raise exception 'FAIL: endpoint not re-assigned to the new user'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
