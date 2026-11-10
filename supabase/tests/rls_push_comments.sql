-- Comment pushes, the comments category, chess game-open push.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); e uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  post uuid; plan uuid; req uuid; c1 uuid; c2 uuid; c3 uuid; ev uuid; ev_plan uuid; ev_feat uuid; n int; denied boolean; j jsonb;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,e,c]) u;
  insert into public.households (id, name, timezone, starting_balance) values (h1, 'H1', 'UTC', 500), (h2, 'H2', 'UTC', 500);
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h1, e, 'member'), (h2, c, 'admin');
  update public.profiles set display_name = 'Bee' where id = b;
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth) values (a, h1, 'ep-a', 'k', 'a'), (b, h1, 'ep-b', 'k', 'a'), (e, h1, 'ep-e', 'k', 'a');
  insert into public.daily_posts (household_id, user_id, photo_path) values (h1, a, 'p') returning id into post;
  insert into public.plans (household_id, created_by, title, starts_at) values (h1, a, 'Taco night', now() + interval '1 day') returning id into plan;
  insert into public.feature_requests (household_id, created_by, title) values (h1, a, 'Dark mode') returning id into req;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.post_comments (post_id, user_id, household_id, body) values (post, b, h1, 'nice shot') returning id into c1;
  insert into public.plan_comments (plan_id, user_id, household_id, body) values (plan, b, h1, 'bringing salsa') returning id into c2;
  insert into public.feature_comments (request_id, user_id, household_id, body) values (req, b, h1, 'yes please') returning id into c3;

  ev := public.notify_comment('post', c1);
  if ev is null then raise exception 'FAIL: fresh own photo comment produced no event'; end if;
  select count(*) into n from public.push_targets('event', ev);
  if n <> 2 then raise exception 'FAIL: photo comment should reach the 2 housemates, got %', n; end if;
  if public.notify_comment('post', c1) is not null then raise exception 'FAIL: same comment announced twice'; end if;
  ev_plan := public.notify_comment('plan', c2);
  select count(*) into n from public.push_targets('event', ev_plan);
  if n <> 2 then raise exception 'FAIL: plan comment push count %', n; end if;
  ev_feat := public.notify_comment('feature', c3);
  if ev_feat is null then raise exception 'FAIL: feature comment produced no event'; end if;
  denied := false; begin perform public.notify_comment('bogus', c1); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: unknown kind accepted'; end if;
  reset role;
  if (select body from public.push_events where id = ev_plan) <> 'bringing salsa' or (select title from public.push_events where id = ev_plan) <> 'Bee commented on Taco night' then raise exception 'FAIL: plan comment text'; end if;
  if (select url from public.push_events where id = ev_feat) <> '/features/' || req then raise exception 'FAIL: feature comment link'; end if;
  if (select category from public.push_events where id = ev_feat) <> 'comments' then raise exception 'FAIL: comments category'; end if;

  -- someone else cannot announce B's comment; stale comments are not announced
  insert into public.post_comments (post_id, user_id, household_id, body, created_at) values (post, b, h1, 'ancient', now() - interval '1 hour') returning id into c1;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.notify_comment('plan', c2) is not null then raise exception 'FAIL: non-author announced a comment'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.notify_comment('post', c1) is not null then raise exception 'FAIL: stale comment announced'; end if;
  reset role;

  -- mute the comments category for E: only A is pinged for the next comment
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_notification_prefs(array['comments'], null, null);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.post_comments (post_id, user_id, household_id, body) values (post, b, h1, 'second comment') returning id into c1;
  ev := public.notify_comment('post', c1);
  select count(*) into n from public.push_targets('event', ev);
  if n <> 1 then raise exception 'FAIL: muted E should leave only A, got %', n; end if;
  reset role;

  -- chess: opening a game pings the house
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.chess_create(0, 'random');
  ev := (j->>'event')::uuid;
  if ev is null then raise exception 'FAIL: chess_create returned no event'; end if;
  select count(*) into n from public.push_targets('event', ev);
  if n <> 2 then raise exception 'FAIL: chess game-open should reach A and E (E only muted comments); got %', n; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.notify_comment('post', c1) is not null then raise exception 'FAIL: outsider announced a comment'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
