-- Profile extras: own-row updates only, avatar storage isolation, last seen.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  n int; denied boolean; seen timestamptz;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name) values (h1, 'H1'), (h2, 'H2');
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set dob = '1999-05-17', nickname = 'B-man' where id = b;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: could not update own profile'; end if;
  update public.profiles set dob = '2000-01-01' where id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: updated another user''s profile'; end if;
  denied := false; begin update public.profiles set dob = '1850-01-01' where id = b; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: absurd dob accepted'; end if;
  perform public.touch_last_seen();
  select last_seen_at into seen from public.profiles where id = b;
  if seen is null then raise exception 'FAIL: last_seen not set'; end if;
  select last_seen_at into seen from public.profiles where id = a;
  if seen is not null then raise exception 'FAIL: touch_last_seen changed someone else'; end if;
  insert into storage.objects (bucket_id, name) values ('avatars', h1 || '/' || b || '/me.jpg');
  denied := false; begin insert into storage.objects (bucket_id, name) values ('avatars', h1 || '/' || a || '/x.jpg'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: uploaded avatar into another user''s folder'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id = 'avatars';
  if n <> 0 then raise exception 'FAIL: outsider reads H1 avatars'; end if;
  select count(*) into n from public.profiles where id in (a, b);
  if n <> 0 then raise exception 'FAIL: outsider reads H1 profiles'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
