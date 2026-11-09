-- Activity feed: shape, ordering, 7-day window, privacy, isolation.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid(); j jsonb; n int; denied boolean; pet uuid;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name, timezone) values (h1, 'H1', 'UTC'), (h2, 'H2', 'UTC');
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');
  update public.profiles set display_name = 'Ada' where id = a;
  update public.profiles set display_name = 'Bee' where id = b;
  update public.profiles set display_name = 'Cy' where id = c;

  insert into public.plans (household_id, created_by, title, starts_at, created_at) values (h1, a, 'Taco night', now() + interval '1 day', now() - interval '2 hours');
  insert into public.rallies (household_id, user_id, label, created_at) values (h1, b, 'Gaming', now() - interval '1 hour');
  insert into public.plans (household_id, created_by, title, starts_at, created_at) values (h1, a, 'Ancient plan', now(), now() - interval '9 days');
  insert into public.plans (household_id, created_by, title, starts_at, created_at) values (h2, c, 'Other house plan', now(), now());
  insert into public.pets (household_id, name, created_by) values (h1, 'Mae', a) returning id into pet;
  insert into public.pet_actions (pet_id, user_id, household_id, kind, local_date, created_at) values (pet, b, h1, 'feed', current_date, now() - interval '30 minutes');
  insert into public.messages (household_id, user_id, recipient_id, body) values (h1, a, b, 'secret dm text');
  insert into public.card_results (household_id, local_date, winner_ids, settled_at) values (h1, current_date - 1, array[b], now() - interval '3 hours');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.activity_feed(20);
  if jsonb_array_length(j) <> 4 then raise exception 'FAIL: expected 4 recent items, got %: %', jsonb_array_length(j), j; end if;
  if j->0->>'text' <> 'Bee fed Mae' then raise exception 'FAIL: newest first: %', j->0; end if;
  if j::text like '%Ancient%' then raise exception 'FAIL: item older than 7 days included'; end if;
  if j::text like '%Other house%' then raise exception 'FAIL: other household leaked'; end if;
  if j::text like '%secret dm%' then raise exception 'FAIL: DM content leaked into the feed'; end if;
  if not (j::text like '%Most likely yesterday: Bee%') then raise exception 'FAIL: card winner missing'; end if;
  if jsonb_array_length(public.activity_feed(2)) <> 2 then raise exception 'FAIL: limit not applied'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.activity_feed(20);
  if jsonb_array_length(j) <> 1 or j::text not like '%Other house plan%' then raise exception 'FAIL: outsider feed wrong: %', j; end if;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  denied := false; begin perform public.activity_feed(5); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: anon can read the feed'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
