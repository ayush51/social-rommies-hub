-- Phase 3 tests: ledger integrity, idempotency, no overdraft, isolation.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  pa uuid; pold uuid; pc uuid; k uuid := gen_random_uuid(); bal bigint; n int; denied boolean;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name, timezone, starting_balance, daily_reward)
    values (h1, 'H1', 'UTC', 500, 50), (h2, 'H2', 'UTC', 500, 50);
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');
  insert into public.daily_posts (household_id, user_id, photo_path) values (h1, a, 'p') returning id into pa;
  insert into public.daily_posts (household_id, user_id, photo_path) values (h1, b, 'p') returning id into pold;
  update public.daily_posts set local_date = current_date - 5 where id = pold;
  insert into public.daily_posts (household_id, user_id, photo_path) values (h2, c, 'p') returning id into pc;

  -- B: starting balance once, daily reward once
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.my_wallet() <> 500 then raise exception 'FAIL: starting balance'; end if;
  if public.my_wallet() <> 500 then raise exception 'FAIL: starting balance granted twice'; end if;
  if public.claim_daily_reward() <> 50 then raise exception 'FAIL: daily reward not granted'; end if;
  if public.claim_daily_reward() <> 0 then raise exception 'FAIL: daily reward claimed twice'; end if;
  if public.my_wallet() <> 550 then raise exception 'FAIL: balance after daily reward'; end if;

  -- tipping: moves coins once even if replayed with the same key
  perform public.tip_post(pa, 20, k);
  perform public.tip_post(pa, 20, k);
  if public.my_wallet() <> 530 then raise exception 'FAIL: replayed tip charged twice'; end if;
  denied := false; begin perform public.tip_post(pa, 0, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: zero tip allowed'; end if;
  denied := false; begin perform public.tip_post(pa, -5, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: negative tip allowed'; end if;
  denied := false; begin perform public.tip_post(pa, 101, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: oversized tip allowed'; end if;
  denied := false; begin perform public.tip_post(pold, 5, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: tipped an expired post'; end if;
  denied := false; begin perform public.tip_post(pc, 5, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: tipped another household'; end if;
  -- direct writes are impossible
  denied := false;
  begin insert into public.ledger_entries (household_id, user_id, amount, kind, idempotency_key) values (h1, b, 999, 'daily', 'x');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct ledger insert'; end if;
  denied := false; begin update public.wallets set balance = 1000000 where user_id = b; get diagnostics n = row_count; if n = 0 then denied := true; end if;
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct wallet update'; end if;
  denied := false; begin perform public.post_ledger(b, h1, 100, 'daily', 'cheat'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: post_ledger callable by users'; end if;
  select count(*) into n from public.ledger_entries;
  if n <> 3 then raise exception 'FAIL: B sees % ledger rows (own only, expected 3)', n; end if;
  reset role;

  -- A got the tip; balance == sum(ledger) invariant
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.my_wallet() <> 520 then raise exception 'FAIL: author balance after tip'; end if;
  select count(*) into n from public.ledger_entries;
  if n <> 2 then raise exception 'FAIL: A sees % entries, expected 2 (own only)', n; end if;
  reset role;
  for bal, n in select w.balance, (select coalesce(sum(amount),0) from public.ledger_entries l where l.user_id = w.user_id) from public.wallets w where w.household_id = h1
  loop if bal <> n then raise exception 'FAIL: wallet % != ledger sum %', bal, n; end if; end loop;

  -- no overdraft
  update public.wallets set balance = 3 where user_id = b;  -- superuser setup
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.tip_post(pa, 5, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: overdraft allowed'; end if;
  reset role;
  denied := false; begin update public.wallets set balance = -1 where user_id = b; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: negative balance accepted by table'; end if;

  -- ledger is immutable even for the table owner
  denied := false; begin update public.ledger_entries set amount = 1; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: ledger update allowed'; end if;
  denied := false; begin delete from public.ledger_entries; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: ledger delete allowed'; end if;

  -- outsider C: sees only own household wallets, no H1 ledger
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.wallets where household_id = h1;
  if n <> 0 then raise exception 'FAIL: C sees H1 wallets'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
