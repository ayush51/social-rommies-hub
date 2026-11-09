-- RLS tests. Run: supabase db query --linked -f supabase/tests/rls.sql
-- Builds its own fixtures and always ends in an exception, so nothing persists.
-- Expected result: error message "ALL RLS TESTS PASSED (rolled back)". Any "FAIL:" is a real failure.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  d uuid := gen_random_uuid(); e uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  n int; denied boolean;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c,d,e]) u;
  insert into public.households (id, name) values (h1, 'H1'), (h2, 'H2');
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');

  -- member B
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.households;
  if n <> 1 then raise exception 'FAIL: B sees % households, expected 1', n; end if;
  select count(*) into n from public.household_members;
  if n <> 2 then raise exception 'FAIL: B sees % members, expected 2', n; end if;
  select count(*) into n from public.profiles;
  if n <> 2 then raise exception 'FAIL: B sees % profiles, expected 2 (self + housemate)', n; end if;
  update public.households set name = 'hacked' where id = h1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: non-admin updated household'; end if;
  update public.household_members set role = 'admin' where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: member self-promoted to admin'; end if;
  denied := false;
  begin insert into public.household_members (household_id, user_id) values (h1, c);
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct insert into household_members allowed'; end if;
  if to_regproc('public.create_invite') is not null or to_regproc('public.redeem_invite') is not null or to_regproc('public.create_household') is not null or to_regclass('public.invites') is not null then raise exception 'FAIL: invite machinery still exists'; end if;
  reset role;

  -- admin A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.households set name = 'H1 renamed' where id = h1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin could not update household'; end if;
  reset role;

  -- outsider C (other household)
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.households;
  if n <> 1 then raise exception 'FAIL: C sees % households, expected 1', n; end if;
  select count(*) into n from public.profiles where id in (a, b);
  if n <> 0 then raise exception 'FAIL: C sees H1 profiles'; end if;
  reset role;

  -- anonymous
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  n := 0;
  begin select count(*) into n from public.households; exception when others then n := 0; end;
  if n <> 0 then raise exception 'FAIL: anon reads households'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
