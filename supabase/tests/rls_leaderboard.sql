-- Bingdon leaderboard: ordering, weekly change, members without a wallet, isolation.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); e uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid(); j jsonb; denied boolean;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,e,c]) u;
  insert into public.households (id, name, timezone, starting_balance) values (h1, 'H1', 'UTC', 500), (h2, 'H2', 'UTC', 500);
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h1, e, 'member'), (h2, c, 'admin');
  update public.profiles set display_name = 'Ada' where id = a;
  update public.profiles set display_name = 'Bee' where id = b;
  update public.profiles set display_name = 'Eve', badge = 'crown' where id = e;
  update public.profiles set display_name = 'Cy' where id = c;

  perform public.ensure_wallet(a, h1);
  perform public.ensure_wallet(b, h1);
  perform public.ensure_wallet(c, h2);
  perform public.post_ledger(b, h1, 100, 'poll', 'lb-b-1');                 -- Bee earns 100 this week -> 600
  perform public.post_ledger(a, h1, -30, 'tip_out', 'lb-a-1');              -- Ada spends 30 -> 470
  insert into public.ledger_entries (household_id, user_id, amount, kind, idempotency_key, created_at)
    values (h1, b, 999, 'game', 'lb-old', now() - interval '10 days');       -- older than a week: must not count toward "week"
  perform public.post_ledger(a, h1, -100, 'adjustment', 'lb-a-adj');        -- corrections never count; -> 370
  update public.wallets set balance = 600 where user_id = b;                -- keep wallet and the intended order explicit

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.bingdon_leaderboard();
  if jsonb_array_length(j) <> 3 then raise exception 'FAIL: expected all 3 members, got %: %', jsonb_array_length(j), j; end if;
  if j->0->>'name' <> 'Bee' or j->1->>'name' <> 'Ada' or j->2->>'name' <> 'Eve' then raise exception 'FAIL: order should be Bee, Ada, Eve: %', j; end if;
  if (j->0->>'week')::int <> 100 then raise exception 'FAIL: Bee week should be 100 (old + welcome excluded), got %', j->0->>'week'; end if;
  if (j->1->>'week')::int <> -30 then raise exception 'FAIL: Ada week should be -30 (adjustment excluded), got %', j->1->>'week'; end if;
  if (j->2->>'balance')::int <> 0 or (j->2->>'week')::int <> 0 then raise exception 'FAIL: member without a wallet should show 0/0: %', j->2; end if;
  if j->2->>'badge' <> 'crown' then raise exception 'FAIL: badge missing'; end if;
  if j::text like '%tip_out%' or j::text like '%idempotency%' then raise exception 'FAIL: transaction details leaked'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.bingdon_leaderboard();
  if jsonb_array_length(j) <> 1 or j->0->>'name' <> 'Cy' then raise exception 'FAIL: outsider should only see their own household: %', j; end if;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  denied := false; begin perform public.bingdon_leaderboard(); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: anon can read the leaderboard'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
