-- Abingdon Street (Monopoly-style): rules, payouts, privacy. Dice/cards are injected via the internal mono_roll.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); e uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  g uuid; g3 uuid; g4 uuid; g5 uuid; g6 uuid; ev uuid; j jsonb; v int; v2 int; n int; denied boolean; txt text; w record;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c,e,d]) u;
  insert into public.households (id, name, timezone, starting_balance) values (h1, 'H1', 'UTC', 500), (h2, 'H2', 'UTC', 500);
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h1, c, 'member'), (h1, e, 'member'), (h2, d, 'admin');
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth)
    values (a, h1, 'ep-a', 'k', 'a'), (b, h1, 'ep-b', 'k', 'a'), (c, h1, 'ep-c', 'k', 'a');

  -- ================= lobby =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.monopoly_create(26, 3); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: buy-in over 25 accepted'; end if;
  denied := false; begin perform public.monopoly_create(10, 7); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: 7 players accepted'; end if;
  j := public.monopoly_create(10, 3);
  g := (j->>'game')::uuid;
  denied := false; begin perform public.monopoly_create(10, 3); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: second open lobby accepted'; end if;
  denied := false; begin insert into public.monopoly_games (household_id, host_id, buy_in, max_players) values (h1, a, 0, 2); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct game insert allowed'; end if;
  denied := false; begin perform public.monopoly_start(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: started a 1-player game'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.monopoly_join(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: outsider joined an H1 lobby'; end if;
  select count(*) into n from public.monopoly_games;
  if n <> 0 then raise exception 'FAIL: outsider sees H1 games'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.monopoly_join(g);
  denied := false; begin perform public.monopoly_join(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: joined twice'; end if;
  denied := false; begin perform public.monopoly_start(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: non-host started the game'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.monopoly_join(g);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.monopoly_join(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: joined a full lobby'; end if;
  reset role;
  select balance into v from public.wallets where user_id = a;
  if v <> 490 then raise exception 'FAIL: buy-in not charged (A has %)', v; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.monopoly_start(g);
  ev := (j->>'event')::uuid;
  select count(*) into n from public.push_targets('game', ev);
  if n <> 2 then raise exception 'FAIL: game-start push should reach B and C devices, got %', n; end if;
  denied := false; begin perform public.monopoly_leave(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: left a started game'; end if;
  denied := false; begin perform public.mono_roll(g, a, 1, 2, 0); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: clients can call the internal dice function'; end if;
  reset role;

  -- ================= turns & rent =================
  denied := false; begin perform public.mono_roll(g, b, 1, 2, 0); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: rolled out of turn'; end if;
  perform public.mono_roll(g, a, 1, 2, 0);                         -- A -> Basement Studio (3)
  if (select turn_phase from public.monopoly_games where id = g) <> 'buy' then raise exception 'FAIL: expected buy phase'; end if;
  denied := false; begin perform public.mono_roll(g, a, 1, 2, 0); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: rolled again while a purchase was pending'; end if;
  denied := false; begin perform public.mono_end_turn(g, a); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: ended turn with a purchase pending'; end if;
  perform public.mono_buy(g, a, true);
  if (select cash from public.monopoly_players where game_id = g and user_id = a) <> 1440 then raise exception 'FAIL: purchase price'; end if;
  if (select owner_id from public.monopoly_props where game_id = g and space = 3) <> a then raise exception 'FAIL: ownership not recorded'; end if;
  if (select turn_phase from public.monopoly_games where id = g) <> 'end' then raise exception 'FAIL: expected end phase after buying'; end if;
  ev := public.mono_end_turn(g, a);
  if (select notify_user from public.monopoly_events where id = ev) <> b then raise exception 'FAIL: turn event should notify B'; end if;

  perform public.mono_roll(g, b, 1, 2, 0);                         -- B lands on A's Basement Studio: rent 4 (no full set)
  if (select cash from public.monopoly_players where game_id = g and user_id = b) <> 1496 then raise exception 'FAIL: B did not pay 4 rent'; end if;
  if (select cash from public.monopoly_players where game_id = g and user_id = a) <> 1444 then raise exception 'FAIL: A did not receive 4 rent'; end if;
  perform public.mono_end_turn(g, b);

  perform public.mono_roll(g, c, 6, 6, 0);                         -- C doubles -> Power Company (12)
  perform public.mono_buy(g, c, true);
  if (select turn_phase from public.monopoly_games where id = g) <> 'roll' then raise exception 'FAIL: doubles should give another roll'; end if;
  perform public.mono_roll(g, c, 3, 4, 0);                         -- non-doubles -> Arcade (19)
  perform public.mono_buy(g, c, false);
  if (select turn_phase from public.monopoly_games where id = g) <> 'end' then raise exception 'FAIL: expected end phase after declining'; end if;
  if exists (select 1 from public.monopoly_props where game_id = g and space = 19) then raise exception 'FAIL: declined property was assigned'; end if;
  perform public.mono_end_turn(g, c);

  -- ================= colour sets, upgrades, rent rules =================
  insert into public.monopoly_props (game_id, space, owner_id, household_id) values (g, 1, a, h1);
  if public.mono_rent(g, 3, a, 7) <> 8 then raise exception 'FAIL: full set should double base rent'; end if;
  denied := false; begin perform public.mono_upgrade(g, b, 12); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: upgraded out of turn / not owned'; end if;
  denied := false; begin perform public.mono_upgrade(g, a, 12); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: upgraded a utility'; end if;
  perform public.mono_upgrade(g, a, 1);
  denied := false; begin perform public.mono_upgrade(g, a, 1); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: even-upgrade rule not enforced'; end if;
  perform public.mono_upgrade(g, a, 3);
  if (select cash from public.monopoly_players where game_id = g and user_id = a) <> 1344 then raise exception 'FAIL: upgrade costs'; end if;
  if public.mono_rent(g, 3, a, 7) <> 20 then raise exception 'FAIL: level-1 rent'; end if;
  if public.mono_rent(g, 12, c, 7) <> 28 then raise exception 'FAIL: single utility rent'; end if;
  insert into public.monopoly_props (game_id, space, owner_id, household_id) values (g, 28, c, h1);
  if public.mono_rent(g, 12, c, 7) <> 70 then raise exception 'FAIL: double utility rent'; end if;
  insert into public.monopoly_props (game_id, space, owner_id, household_id) values (g, 5, c, h1), (g, 15, c, h1);
  if public.mono_rent(g, 5, c, 7) <> 50 then raise exception 'FAIL: two-station rent'; end if;
  delete from public.monopoly_props where game_id = g and space in (28, 5, 15);

  -- ================= jail =================
  update public.monopoly_players set position = 27 where game_id = g and user_id = a;
  perform public.mono_roll(g, a, 1, 2, 0);                         -- lands on Go to the Couch
  if not (select in_jail from public.monopoly_players where game_id = g and user_id = a) or (select position from public.monopoly_players where game_id = g and user_id = a) <> 10 then raise exception 'FAIL: not jailed'; end if;
  if (select current_seat from public.monopoly_games where id = g) <> 2 then raise exception 'FAIL: jailing should end the turn'; end if;

  update public.monopoly_games set current_seat = 1, turn_phase = 'roll', doubles = 0 where id = g;
  perform public.mono_roll(g, a, 2, 2, 0);                         -- doubles frees A; moves 4 from the Couch -> Noodle Bar (14), no extra roll
  if (select in_jail from public.monopoly_players where game_id = g and user_id = a) or (select position from public.monopoly_players where game_id = g and user_id = a) <> 14 then raise exception 'FAIL: doubles did not free A'; end if;
  if (select turn_phase from public.monopoly_games where id = g) <> 'buy' then raise exception 'FAIL: expected buy phase after leaving jail'; end if;
  perform public.mono_buy(g, a, false);
  if (select turn_phase from public.monopoly_games where id = g) <> 'end' then raise exception 'FAIL: leaving jail on doubles must not grant an extra roll'; end if;

  update public.monopoly_players set position = 10, in_jail = true, jail_turns = 0 where game_id = g and user_id = a;
  update public.monopoly_games set current_seat = 1, turn_phase = 'roll', doubles = 0 where id = g;
  select cash into v from public.monopoly_players where game_id = g and user_id = a;
  perform public.mono_pay_jail(g, a);
  if (select cash from public.monopoly_players where game_id = g and user_id = a) <> v - 50 then raise exception 'FAIL: jail fee'; end if;
  denied := false; begin perform public.mono_pay_jail(g, a); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: paid to leave when not jailed'; end if;

  update public.monopoly_players set position = 10, in_jail = true, jail_turns = 2 where game_id = g and user_id = a;
  select cash into v from public.monopoly_players where game_id = g and user_id = a;
  perform public.mono_roll(g, a, 1, 2, 0);                         -- third failed try: pays 50, moves to Taco Truck (13)
  if (select in_jail from public.monopoly_players where game_id = g and user_id = a) or (select cash from public.monopoly_players where game_id = g and user_id = a) <> v - 50 or (select position from public.monopoly_players where game_id = g and user_id = a) <> 13 then raise exception 'FAIL: third jail roll'; end if;
  perform public.mono_buy(g, a, false);

  update public.monopoly_players set position = 10, in_jail = true, jail_turns = 0 where game_id = g and user_id = a;
  update public.monopoly_games set current_seat = 1, turn_phase = 'roll', doubles = 0 where id = g;
  perform public.mono_roll(g, a, 1, 2, 0);                         -- stays, turn passes
  if not (select in_jail from public.monopoly_players where game_id = g and user_id = a) or (select jail_turns from public.monopoly_players where game_id = g and user_id = a) <> 1 or (select current_seat from public.monopoly_games where id = g) <> 2 then raise exception 'FAIL: failed jail roll'; end if;

  -- ================= Start, tax, doubles, three doubles =================
  update public.monopoly_players set in_jail = false, position = 38 where game_id = g and user_id = a;
  update public.monopoly_games set current_seat = 1, turn_phase = 'roll', doubles = 0 where id = g;
  select cash into v from public.monopoly_players where game_id = g and user_id = a;
  perform public.mono_roll(g, a, 1, 3, 0);                         -- passes Start (+200) to House Fund (2), card 0 (+100)
  if (select cash from public.monopoly_players where game_id = g and user_id = a) <> v + 300 then raise exception 'FAIL: Start salary + card'; end if;

  update public.monopoly_players set position = 0 where game_id = g and user_id = a;
  update public.monopoly_games set current_seat = 1, turn_phase = 'roll', doubles = 0 where id = g;
  select cash into v from public.monopoly_players where game_id = g and user_id = a;
  perform public.mono_roll(g, a, 2, 2, 0);                         -- Rent Day tax 200, doubles -> roll again
  if (select cash from public.monopoly_players where game_id = g and user_id = a) <> v - 200 then raise exception 'FAIL: tax'; end if;
  if (select turn_phase from public.monopoly_games where id = g) <> 'roll' or (select doubles from public.monopoly_games where id = g) <> 1 then raise exception 'FAIL: doubles bookkeeping'; end if;

  update public.monopoly_players set position = 0 where game_id = g and user_id = a;
  update public.monopoly_games set current_seat = 1, turn_phase = 'roll', doubles = 2 where id = g;
  perform public.mono_roll(g, a, 3, 3, 0);                         -- third double in a row
  if not (select in_jail from public.monopoly_players where game_id = g and user_id = a) then raise exception 'FAIL: three doubles should jail'; end if;

  -- ================= cards =================
  update public.monopoly_players set in_jail = false, position = 0 where game_id = g and user_id = a;
  update public.monopoly_games set current_seat = 1, turn_phase = 'roll', doubles = 0 where id = g;
  select cash into v from public.monopoly_players where game_id = g and user_id = a;
  select cash into v2 from public.monopoly_players where game_id = g and user_id = b;
  perform public.mono_roll(g, a, 3, 4, 7);                         -- pay each roommate 25
  if (select cash from public.monopoly_players where game_id = g and user_id = a) <> v - 50 or (select cash from public.monopoly_players where game_id = g and user_id = b) <> v2 + 25 then raise exception 'FAIL: pay-everyone card'; end if;
  update public.monopoly_players set position = 0 where game_id = g and user_id = a;
  update public.monopoly_games set current_seat = 1, turn_phase = 'roll', doubles = 0 where id = g;
  select cash into v from public.monopoly_players where game_id = g and user_id = a;
  perform public.mono_roll(g, a, 3, 4, 8);                         -- everyone pays A 25
  if (select cash from public.monopoly_players where game_id = g and user_id = a) <> v + 50 then raise exception 'FAIL: collect-from-everyone card'; end if;
  update public.monopoly_players set position = 0 where game_id = g and user_id = a;
  update public.monopoly_games set current_seat = 1, turn_phase = 'roll', doubles = 0 where id = g;
  perform public.mono_roll(g, a, 3, 4, 4);                         -- advance to Start
  if (select position from public.monopoly_players where game_id = g and user_id = a) <> 0 then raise exception 'FAIL: advance-to-Start card'; end if;
  update public.monopoly_players set position = 0 where game_id = g and user_id = a;
  update public.monopoly_games set current_seat = 1, turn_phase = 'roll', doubles = 0 where id = g;
  perform public.mono_roll(g, a, 3, 4, 5);                         -- go to the Couch
  if not (select in_jail from public.monopoly_players where game_id = g and user_id = a) then raise exception 'FAIL: jail card'; end if;
  update public.monopoly_players set in_jail = false, position = 0 where game_id = g and user_id = a;

  -- ================= bankruptcy and the pot =================
  insert into public.monopoly_props (game_id, space, owner_id, household_id) values (g, 31, b, h1);
  update public.monopoly_players set cash = 1, position = 0 where game_id = g and user_id = b;
  update public.monopoly_games set current_seat = 2, turn_phase = 'roll', doubles = 0 where id = g;
  ev := public.mono_roll(g, b, 1, 2, 0);                           -- B lands on A's level-1 Basement Studio (rent 20) with $1
  if not (select bankrupt from public.monopoly_players where game_id = g and user_id = b) then raise exception 'FAIL: B should be bankrupt'; end if;
  if (select owner_id from public.monopoly_props where game_id = g and space = 31) <> a then raise exception 'FAIL: bankrupt assets did not go to the creditor'; end if;
  if (select status from public.monopoly_games where id = g) <> 'playing' then raise exception 'FAIL: game should continue with 2 players'; end if;
  if (select current_seat from public.monopoly_games where id = g) = 2 then raise exception 'FAIL: turn did not move off the bankrupt player'; end if;

  update public.monopoly_players set cash = 0, position = 0 where game_id = g and user_id = c;
  update public.monopoly_games set current_seat = 3, turn_phase = 'roll', doubles = 0 where id = g;
  ev := public.mono_roll(g, c, 1, 2, 0);                           -- C is broke too
  if (select status from public.monopoly_games where id = g) <> 'finished' or (select winner_id from public.monopoly_games where id = g) <> a then raise exception 'FAIL: A should win'; end if;
  if (select notify_mode from public.monopoly_events where id = ev) <> 'house' then raise exception 'FAIL: winner announcement should notify the house'; end if;
  select count(*), coalesce(sum(amount), 0) into n, v from public.ledger_entries where kind = 'game_win' and user_id = a;
  if n <> 1 or v <> 30 then raise exception 'FAIL: pot payout % entries / % coins (expected 1 / 30)', n, v; end if;
  if public.mono_finish_if_won(g) is not null then raise exception 'FAIL: finished game paid out again'; end if;
  denied := false; begin perform public.mono_roll(g, a, 1, 2, 0); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: moved in a finished game'; end if;

  -- ================= resign =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g3 := (public.monopoly_create(0, 2)->>'game')::uuid;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.monopoly_join(g3);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.monopoly_start(g3);
  reset role;
  perform public.mono_resign(g3, b);
  if (select winner_id from public.monopoly_games where id = g3) <> a then raise exception 'FAIL: resigning should hand A the win'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g4 := (public.monopoly_create(5, 3)->>'game')::uuid;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated; perform public.monopoly_join(g4); reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated; perform public.monopoly_join(g4); reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated; perform public.monopoly_start(g4); reset role;
  perform public.mono_resign(g4, a);                               -- A's turn: passes to B
  if (select current_seat from public.monopoly_games where id = g4) <> 2 then raise exception 'FAIL: resigning on your turn should pass it on'; end if;
  perform public.mono_resign(g4, b);
  if (select winner_id from public.monopoly_games where id = g4) <> c then raise exception 'FAIL: C should win g4'; end if;
  select coalesce(sum(amount), 0) into v from public.ledger_entries where kind = 'game_win' and user_id = c;
  if v <> 15 then raise exception 'FAIL: g4 pot is 15, got %', v; end if;

  -- ================= idle skips =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g5 := (public.monopoly_create(0, 3)->>'game')::uuid;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated; perform public.monopoly_join(g5); reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated; perform public.monopoly_join(g5); reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated; perform public.monopoly_start(g5); reset role;
  denied := false; begin perform public.mono_skip(g5, b); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: skipped a player who is not idle'; end if;
  update public.monopoly_games set turn_started_at = now() - interval '25 hours' where id = g5;
  denied := false; begin perform public.mono_skip(g5, a); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: skipped your own turn'; end if;
  perform public.mono_skip(g5, b);
  if (select current_seat from public.monopoly_games where id = g5) <> 2 or (select idle_skips from public.monopoly_players where game_id = g5 and user_id = a) <> 1 then raise exception 'FAIL: first skip'; end if;
  for n in 1..2 loop
    update public.monopoly_games set current_seat = 1, turn_started_at = now() - interval '25 hours' where id = g5;
    perform public.mono_skip(g5, b);
  end loop;
  if not (select bankrupt from public.monopoly_players where game_id = g5 and user_id = a) then raise exception 'FAIL: three skips should remove the player'; end if;

  -- ================= lobby refunds =================
  select balance into v from public.wallets where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g6 := (public.monopoly_create(10, 3)->>'game')::uuid;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select balance into v2 from public.wallets where user_id = c;
  perform public.monopoly_join(g6);
  perform public.monopoly_leave(g6);
  reset role;
  if (select balance from public.wallets where user_id = c) <> v2 then raise exception 'FAIL: leaving a lobby did not refund'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.monopoly_leave(g6); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: host left instead of cancelling'; end if;
  perform public.monopoly_cancel(g6);
  reset role;
  if (select balance from public.wallets where user_id = b) <> v then raise exception 'FAIL: cancelling did not refund the host'; end if;

  -- ================= privacy and direct writes =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin update public.monopoly_players set cash = 999999 where user_id = a; get diagnostics n = row_count; if n = 0 then denied := true; end if; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: players can edit their own cash'; end if;
  denied := false; begin insert into public.monopoly_props (game_id, space, owner_id, household_id) values (g5, 39, a, h1); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct property grant'; end if;
  denied := false; begin delete from public.monopoly_events; get diagnostics n = row_count; if n = 0 then denied := true; end if; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: events deletable'; end if;
  select count(*) into n from public.monopoly_spaces;
  if n <> 40 then raise exception 'FAIL: board not readable'; end if;
  select count(*) into n from public.monopoly_games;
  if n < 5 then raise exception 'FAIL: housemate cannot read games'; end if;
  reset role;

  -- ================= conservation =================
  for w in select wl.user_id, wl.balance, (select coalesce(sum(amount), 0) from public.ledger_entries l where l.user_id = wl.user_id) s
           from public.wallets wl where wl.household_id = h1 loop
    if w.balance <> w.s then raise exception 'FAIL: wallet % != ledger %', w.balance, w.s; end if;
  end loop;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
