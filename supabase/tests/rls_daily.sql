-- Phase 4 RLS tests (daily photos, expiry, memories, private storage).
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  pa uuid; pold uuid; n int; denied boolean;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name, timezone) values (h1, 'H1', 'UTC'), (h2, 'H2', 'UTC');
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');

  -- A posts today (date is set by trigger, not the client); an old post is planted as superuser
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.daily_posts (household_id, user_id, local_date, photo_path)
    values (h1, a, '2000-01-01', h1 || '/' || a || '/x.jpg') returning id into pa;
  select count(*) into n from public.daily_posts where local_date = public.household_today(h1);
  if n <> 1 then raise exception 'FAIL: client-supplied local_date was not overridden'; end if;
  denied := false;
  begin insert into public.daily_posts (household_id, user_id, photo_path) values (h1, a, 'dup');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: second post same day allowed'; end if;
  reset role;
  insert into public.daily_posts (household_id, user_id, local_date, photo_path)
    values (h1, b, current_date - 3, 'old') returning id into pold;
  update public.daily_posts set local_date = current_date - 3 where id = pold;

  -- B: sees only today's post; old one hidden from the feed but present in memories()
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.daily_posts;
  if n <> 1 then raise exception 'FAIL: B feed shows % posts, expected only today''s', n; end if;
  select count(*) into n from public.memories(h1);
  if n <> 1 then raise exception 'FAIL: memories returned % rows, expected 1', n; end if;
  insert into public.post_reactions (post_id, user_id, household_id, emoji) values (pa, b, h1, 'x');
  insert into public.post_comments (post_id, user_id, household_id, body) values (pa, b, h1, 'nice');
  denied := false;
  begin insert into public.post_comments (post_id, user_id, household_id, body) values (pold, b, h1, 'late');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: commented on an expired post'; end if;
  denied := false;
  begin insert into public.daily_posts (household_id, user_id, photo_path) values (h1, a, 'spoof');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: posted as another user'; end if;
  update public.daily_posts set caption = 'hacked' where id = pa;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: edited another user''s post'; end if;
  -- storage
  insert into storage.objects (bucket_id, name) values ('daily', h1 || '/' || b || '/mine.jpg');
  denied := false;
  begin insert into storage.objects (bucket_id, name) values ('daily', h1 || '/' || a || '/theirs.jpg');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: uploaded into another user''s folder'; end if;
  denied := false;
  begin insert into storage.objects (bucket_id, name) values ('daily', h2 || '/' || b || '/x.jpg');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: uploaded into another household''s folder'; end if;
  reset role;

  -- outsider C sees and reaches nothing
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select (select count(*) from public.daily_posts) + (select count(*) from public.post_comments where household_id = h1)
       + (select count(*) from storage.objects where bucket_id = 'daily') into n;
  if n <> 0 then raise exception 'FAIL: C sees % H1 rows', n; end if;
  denied := false;
  begin perform public.memories(h1);
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: C read H1 memories'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
