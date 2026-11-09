-- Daily card v2 (pick a roommate): hidden counts, one reward/day, isolation, crowning.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); e uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  j jsonb; n int; denied boolean; past date := current_date - 2;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,e,c]) u;
  insert into public.households (id, name, timezone) values (h1, 'H1', 'UTC'), (h2, 'H2', 'UTC');
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h1, e, 'member'), (h2, c, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.card_today();
  if jsonb_array_length(j->'options') <> 3 then raise exception 'FAIL: expected the 3 roommates as options, got %', j->'options'; end if;
  if j::text like '%"votes": 0%' or (j->'options'->0->'votes') <> 'null'::jsonb then raise exception 'FAIL: counts visible before voting: %', j->'options'; end if;
  if (j->>'voted')::boolean then raise exception 'FAIL: voted flag before voting'; end if;
  perform public.pick_card(b);
  perform public.pick_card(e);   -- change of mind
  perform public.pick_card(a);   -- picking yourself is allowed
  j := public.card_today();
  if not (j->>'voted')::boolean or (j->>'my_pick') <> a::text then raise exception 'FAIL: my_pick not recorded'; end if;
  if (select sum((o->>'votes')::int) from jsonb_array_elements(j->'options') o) <> 1 then raise exception 'FAIL: one voter should count once'; end if;
  denied := false; begin perform public.pick_card(c); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: picked someone from another household'; end if;
  denied := false; begin perform public.pick_card(gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: picked a non-member'; end if;
  denied := false; begin perform count(*) from public.card_picks; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: card_picks directly readable'; end if;
  reset role;
  select count(*) into n from public.ledger_entries where kind = 'game' and user_id = a;
  if n <> 1 then raise exception 'FAIL: % rewards for A (expected 1 despite re-picks)', n; end if;

  -- B votes for E; counts now show for B (a fresh voter) only after B votes
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.card_today();
  if (j->'options'->0->'votes') <> 'null'::jsonb then raise exception 'FAIL: B saw counts before voting'; end if;
  if (j->>'voted_count')::int <> 1 then raise exception 'FAIL: voted_count should be 1'; end if;
  perform public.pick_card(e);
  j := public.card_today();
  if (select (o->>'votes')::int from jsonb_array_elements(j->'options') o where o->>'id' = e::text) <> 1 then raise exception 'FAIL: tally for E'; end if;
  reset role;

  -- outsider C is isolated
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.card_today();
  if jsonb_array_length(j->'options') <> 1 or (j->>'voted_count')::int <> 0 then raise exception 'FAIL: C sees H1 data'; end if;
  reset role;

  -- crowning of a finished day: E gets 2 votes, A 1; plus a tie day
  insert into public.card_picks (household_id, local_date, voter_id, pick_id) values
    (h1, past, a, e), (h1, past, b, e), (h1, past, e, a),
    (h1, past - 1, a, b), (h1, past - 1, b, a);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.card_history(7);
  perform public.card_history(7);
  reset role;
  select count(*) into n from public.card_results where household_id = h1;
  if n <> 2 then raise exception 'FAIL: expected 2 settled days, got %', n; end if;
  if jsonb_array_length(j->'rounds'->0->'winners') <> 1 then raise exception 'FAIL: one winner on the first day: %', j->'rounds'->0; end if;
  if jsonb_array_length(j->'rounds'->1->'winners') <> 2 then raise exception 'FAIL: tie should crown both: %', j->'rounds'->1; end if;
  if (j->'rounds'->0->'results'->0->>'votes')::int <> 2 then raise exception 'FAIL: results tally'; end if;
  select count(*) into n from public.ledger_entries where kind = 'game' and user_id in (a, b, e);
  if n <> 2 then raise exception 'FAIL: settlement must not pay coins (got % game entries)', n; end if;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
