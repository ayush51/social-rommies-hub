-- Thirsty Thursdays: phases, lock, one reward per week, private votes, admin-only dishes.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); e uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  d1 uuid; d2 uuid; d3 uuid; dx uuid; w record; j jsonb; n int; denied boolean;
  wed timestamptz := '2026-11-04 12:00+00';   -- Wednesday, before the 18:00 lock
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,e,c]) u;
  insert into public.households (id, name, timezone) values (h1, 'H1', 'UTC'), (h2, 'H2', 'UTC');
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h1, e, 'member'), (h2, c, 'admin');
  insert into public.dishes (household_id, name) values (h1, 'Tacos') returning id into d1;
  insert into public.dishes (household_id, name) values (h1, 'Pad thai') returning id into d2;
  insert into public.dishes (household_id, name, active) values (h1, 'Retired dish', false) returning id into d3;
  insert into public.dishes (household_id, name) values (h2, 'Other house dish') returning id into dx;

  -- phases
  select * into w from public.poll_window(h1, wed);
  if w.phase <> 'open' or w.week_start <> '2026-11-03' or w.cook_day <> '2026-11-05' then raise exception 'FAIL: Wed noon window %/%/%', w.phase, w.week_start, w.cook_day; end if;
  select * into w from public.poll_window(h1, '2026-11-03 00:00+00');
  if w.phase <> 'open' or w.week_start <> '2026-11-03' then raise exception 'FAIL: Tuesday 00:00 should open the poll'; end if;
  select * into w from public.poll_window(h1, '2026-11-04 19:00+00');
  if w.phase <> 'locked' then raise exception 'FAIL: Wed 19:00 should be locked, got %', w.phase; end if;
  select * into w from public.poll_window(h1, '2026-11-05 22:00+00');
  if w.phase <> 'locked' then raise exception 'FAIL: Thursday night should still show the winner'; end if;
  select * into w from public.poll_window(h1, '2026-11-09 23:00+00');
  if w.phase <> 'done' or w.week_start <> '2026-11-03' then raise exception 'FAIL: Monday should be done for the old week'; end if;
  select * into w from public.poll_window(h1, '2026-11-10 00:00+00');
  if w.phase <> 'open' or w.week_start <> '2026-11-10' then raise exception 'FAIL: next Tuesday should start a new poll'; end if;

  -- voting
  perform public.do_vote(a, d2, wed);
  perform public.do_vote(a, d1, wed);   -- change of mind
  perform public.do_vote(b, d1, wed);
  perform public.do_vote(e, d1, wed);
  select count(*) into n from public.ledger_entries where kind = 'poll' and user_id = a;
  if n <> 1 then raise exception 'FAIL: % poll rewards for A (expected 1 despite re-vote)', n; end if;
  denied := false; begin perform public.do_vote(a, d3, wed); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: voted for an inactive dish'; end if;
  denied := false; begin perform public.do_vote(a, dx, wed); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: voted for another household''s dish'; end if;
  denied := false; begin perform public.do_vote(c, d1, wed); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: outsider voted in H1 poll'; end if;
  denied := false; begin perform public.do_vote(a, d1, '2026-11-04 19:00+00'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: voted after lock'; end if;

  j := public.poll_state(a, wed);
  if (j->>'total_votes')::int <> 3 or j->'winner' <> 'null'::jsonb then raise exception 'FAIL: open poll should show totals but no winner: %', j; end if;
  if (j->'dishes'->0->>'votes')::int <> 3 or j->'dishes'->0->>'name' <> 'Tacos' then raise exception 'FAIL: totals wrong: %', j->'dishes'; end if;
  if j->>'my_vote' <> d1::text then raise exception 'FAIL: my_vote'; end if;
  if j::text like '%Retired dish%' then raise exception 'FAIL: inactive unvoted dish listed'; end if;
  j := public.poll_state(a, '2026-11-05 10:00+00');
  if j->'winner'->>'name' <> 'Tacos' or (j->'winner'->>'votes')::int <> 3 then raise exception 'FAIL: winner: %', j->'winner'; end if;
  j := public.poll_state(a, '2026-11-10 10:00+00');
  if (j->>'total_votes')::int <> 0 then raise exception 'FAIL: new week should start empty'; end if;

  -- client-facing wrappers + RLS
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.thursday_poll();
  if j->>'phase' not in ('open','locked','done') then raise exception 'FAIL: thursday_poll shape'; end if;
  denied := false; begin perform public.do_vote(b, d1, wed); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: clients can call do_vote with their own clock'; end if;
  denied := false; begin perform count(*) from public.poll_votes; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: poll_votes readable by clients'; end if;
  denied := false; begin insert into public.dishes (household_id, name) values (h1, 'Sneaky'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: member added a dish'; end if;
  update public.households set cook_name = 'Hacker' where id = h1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: member changed poll settings'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.dishes (household_id, name) values (h1, 'Ramen');
  denied := false; begin insert into public.dishes (household_id, name) values (h1, 'RAMEN'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: duplicate dish (case-insensitive) accepted'; end if;
  update public.dishes set active = false where id = d2;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin could not retire a dish'; end if;
  update public.households set cook_name = 'Micah', poll_lock_dow = 4, poll_lock_time = '12:00' where id = h1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin could not change settings'; end if;
  denied := false; begin update public.households set poll_lock_dow = 5 where id = h1; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: lock day after Thursday accepted'; end if;
  denied := false; begin delete from public.dishes where id = d1; get diagnostics n = row_count; if n = 0 then denied := true; end if; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: dish deleted'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.dishes where household_id = h1;
  if n <> 0 then raise exception 'FAIL: outsider sees H1 dishes'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
