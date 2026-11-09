-- Prediction markets: validation, betting rules, exact payouts, refunds, isolation.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); e uuid := gen_random_uuid();
  r uuid := gen_random_uuid(); p uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  m1 uuid; mc uuid; md uuid; mn uuid; mx uuid; ma uuid; mf uuid; mr uuid; mo uuid;
  y uuid; nn uuid; k uuid := gen_random_uuid(); n int; bal bigint; denied boolean; i int; w record;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,e,r,p,c]) u;
  insert into public.households (id, name, timezone, starting_balance) values (h1, 'H1', 'UTC', 500), (h2, 'H2', 'UTC', 500);
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h1, e, 'member'), (h1, r, 'member'), (h1, p, 'member'), (h2, c, 'admin');

  -- ---- creation rules (as A)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.create_market('hi', null, array['Yes','No'], now() + interval '1 day', r); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: too-short question accepted'; end if;
  denied := false; begin perform public.create_market('Will it rain?', null, array['Yes'], now() + interval '1 day', r); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: single option accepted'; end if;
  denied := false; begin perform public.create_market('Will it rain?', null, array['1','2','3','4','5'], now() + interval '1 day', r); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: 5 options accepted'; end if;
  denied := false; begin perform public.create_market('Will it rain?', null, array['Yes','yes'], now() + interval '1 day', r); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: duplicate options accepted'; end if;
  denied := false; begin perform public.create_market('Will it rain?', null, array['Yes','No'], now() - interval '1 hour', r); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: past closing time accepted'; end if;
  denied := false; begin perform public.create_market('Will it rain?', null, array['Yes','No'], now() + interval '90 days', r); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: 90-day market accepted'; end if;
  denied := false; begin perform public.create_market('Will it rain?', null, array['Yes','No'], now() + interval '1 day', c); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: outsider accepted as resolver'; end if;
  denied := false; begin insert into public.markets (household_id, created_by, resolver_id, question, closes_at) values (h1, a, r, 'direct insert', now() + interval '1 day'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct market insert allowed'; end if;
  m1 := public.create_market('Will Jesse hang out with us this week?', 'Any plan counts', array['Yes','No'], now() + interval '2 days', r);
  mc := public.create_market('Closing soon market', null, array['Yes','No'], now() + interval '5 minutes', r);
  md := public.create_market('Dust market', null, array['Yes','No'], now() + interval '2 days', r);
  mn := public.create_market('Nobody-wins market', null, array['Yes','No'], now() + interval '2 days', r);
  perform public.create_market('Fifth in an hour', null, array['Yes','No'], now() + interval '2 days', r);
  denied := false; begin perform public.create_market('Sixth in an hour', null, array['Yes','No'], now() + interval '2 days', r); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: market creation not rate-limited'; end if;
  reset role;

  -- more markets made by other creators to avoid A's rate limit
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  mx := public.create_market('Cancel me', null, array['Yes','No'], now() + interval '2 days', r);
  ma := public.create_market('Admin resolves this', null, array['Yes','No'], now() + interval '2 days', r);
  mf := public.create_market('Poor user market', null, array['Yes','No'], now() + interval '2 days', r);
  mr := public.create_market('Reminder market', null, array['Yes','No'], now() + interval '2 days', r);
  reset role;
  select id into y from public.market_options where market_id = m1 and position = 1;
  select id into nn from public.market_options where market_id = m1 and position = 2;
  update public.markets set closes_at = now() - interval '1 minute' where id = mc;

  -- ---- betting
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.place_bet(m1, y, 25, k);
  perform public.place_bet(m1, y, 25, k);                       -- replay: no second charge
  perform public.place_bet(m1, y, 5, gen_random_uuid());        -- top-up
  select amount into n from public.market_bets where market_id = m1 and user_id = a;
  if n <> 30 then raise exception 'FAIL: A stake %, expected 30 (replay must not double-charge)', n; end if;
  denied := false; begin perform public.place_bet(m1, nn, 5, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: switched sides after betting'; end if;
  denied := false; begin perform public.place_bet(m1, y, 0, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: zero bet accepted'; end if;
  denied := false; begin perform public.place_bet(m1, y, 501, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: oversized bet accepted'; end if;
  denied := false; begin perform public.place_bet(m1, gen_random_uuid(), 5, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: unknown option accepted'; end if;
  denied := false; begin perform public.place_bet(mc, (select id from public.market_options where market_id = mc limit 1), 5, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: bet after closing time accepted'; end if;
  denied := false; begin insert into public.market_bets (market_id, user_id, option_id, household_id, amount) values (m1, a, y, h1, 999); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct bet insert allowed'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.place_bet(m1, y, 10, gen_random_uuid());
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.place_bet(m1, nn, 20, gen_random_uuid());
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.place_bet(m1, y, 5, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: resolver bet on own market'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.place_bet(m1, y, 5, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: outsider bet in H1 market'; end if;
  select count(*) into n from public.markets;
  if n <> 0 then raise exception 'FAIL: outsider sees % H1 markets', n; end if;
  reset role;

  -- insufficient balance: P spends everything (500 max bet), then cannot bet more
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.place_bet(mf, (select id from public.market_options where market_id = mf and position = 1), 500, gen_random_uuid());
  denied := false; begin perform public.place_bet(m1, y, 1, gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: bet with an empty wallet accepted'; end if;
  reset role;

  -- ---- resolution: only resolver/admin, exact payouts, once
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.resolve_market(m1, y); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: non-resolver resolved the market'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.resolve_market(m1, y);
  denied := false; begin perform public.resolve_market(m1, nn); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: market resolved twice'; end if;
  denied := false; begin perform public.cancel_market(m1); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: settled market cancelled'; end if;
  reset role;
  select balance into bal from public.wallets where user_id = a;
  if bal <> 500 - 30 + 45 then raise exception 'FAIL: A balance % expected 515', bal; end if;
  select balance into bal from public.wallets where user_id = b;
  if bal <> 500 - 10 + 15 then raise exception 'FAIL: B balance % expected 505', bal; end if;
  select balance into bal from public.wallets where user_id = e;
  if bal <> 500 - 20 then raise exception 'FAIL: loser E balance % expected 480', bal; end if;
  select coalesce(sum(amount), 0) into n from public.ledger_entries where kind = 'bet_payout' and ref = m1::text;
  if n <> 60 then raise exception 'FAIL: payouts % != pool 60', n; end if;

  -- rounding: pool 3, two winners with 1 each: all 3 coins are paid out, none lost
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.place_bet(md, (select id from public.market_options where market_id = md and position = 1), 1, gen_random_uuid());
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.place_bet(md, (select id from public.market_options where market_id = md and position = 1), 1, gen_random_uuid());
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.place_bet(md, (select id from public.market_options where market_id = md and position = 2), 1, gen_random_uuid());
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.resolve_market(md, (select id from public.market_options where market_id = md and position = 1));
  reset role;
  select coalesce(sum(amount), 0) into n from public.ledger_entries where kind = 'bet_payout' and ref = md::text;
  if n <> 3 then raise exception 'FAIL: rounding lost coins, paid % of 3', n; end if;

  -- nobody backed the winner: refund everyone
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.place_bet(mn, (select id from public.market_options where market_id = mn and position = 1), 10, gen_random_uuid());
  reset role;
  select balance into bal from public.wallets where user_id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.resolve_market(mn, (select id from public.market_options where market_id = mn and position = 2));
  reset role;
  if (select status from public.markets where id = mn) <> 'cancelled' then raise exception 'FAIL: no-winner market should be cancelled'; end if;
  if (select balance from public.wallets where user_id = a) <> bal + 10 then raise exception 'FAIL: no-winner refund missing'; end if;

  -- cancel: creator (B) or resolver or admin only; refunds exactly once
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.place_bet(mx, (select id from public.market_options where market_id = mx and position = 1), 7, gen_random_uuid());
  reset role;
  select balance into bal from public.wallets where user_id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.cancel_market(mx); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: uninvolved member cancelled a market'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.cancel_market(mx, 'plans changed');
  denied := false; begin perform public.cancel_market(mx); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: market cancelled twice'; end if;
  reset role;
  if (select balance from public.wallets where user_id = a) <> bal + 7 then raise exception 'FAIL: cancel refund wrong'; end if;

  -- admin (A) can resolve a market whose resolver is someone else
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.place_bet(ma, (select id from public.market_options where market_id = ma and position = 1), 5, gen_random_uuid());
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.resolve_market(ma, (select id from public.market_options where market_id = ma and position = 1));
  reset role;
  if (select status from public.markets where id = ma) <> 'resolved' then raise exception 'FAIL: admin could not resolve'; end if;

  -- conservation: every wallet equals the sum of its ledger (no coins created or destroyed)
  for w in select wl.user_id, wl.balance, (select coalesce(sum(amount), 0) from public.ledger_entries l where l.user_id = wl.user_id) s
           from public.wallets wl where wl.household_id = h1 loop
    if w.balance <> w.s then raise exception 'FAIL: wallet % != ledger %', w.balance, w.s; end if;
  end loop;

  -- push + resolver reminder
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth) values (b, h1, 'ep-b', 'k', 'a');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.push_targets('market', m1);
  if n <> 1 then raise exception 'FAIL: new market should notify the one subscribed housemate, got %', n; end if;
  reset role;

  update public.markets set closes_at = now() - interval '1 hour' where id = mr;
  if public.enqueue_market_reminders() <> 2 then raise exception 'FAIL: expected reminders for the 2 closed, unresolved markets'; end if;
  if public.enqueue_market_reminders() <> 0 then raise exception 'FAIL: resolver reminder queued twice'; end if;
  if exists (select 1 from public.reminder_outbox where kind = 'market_due' and recipients <> array[r]) then raise exception 'FAIL: reminder not addressed only to the resolver'; end if;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
