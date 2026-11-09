-- Chess: lobby rules, secret-gated moves, payouts, draws/resign/idle, privacy. Everything rolls back.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); e uuid := gen_random_uuid();
  d uuid := gen_random_uuid(); f uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid(); h3 uuid := gen_random_uuid();
  g uuid; g2 uuid; g3 uuid; g4 uuid; g5 uuid; g6 uuid; j jsonb; ev uuid; n int; denied boolean; msg text; sec text;
  ba int; bb int; bc int; be int; gm public.chess_games; w record;
  start_fen text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  fen_b text := 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  fen_w text := 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c,e,d,f]) u;
  insert into public.households (id, name, timezone, starting_balance) values (h1, 'H1', 'UTC', 500), (h2, 'H2', 'UTC', 500), (h3, 'H3', 'UTC', 0);
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h1, c, 'member'), (h1, e, 'member'), (h2, d, 'admin'), (h3, f, 'admin');
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth) values (a, h1, 'ep-a', 'k', 'a'), (b, h1, 'ep-b', 'k', 'a');
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'chess_secret';
  if sec is null then perform vault.create_secret('t3st', 'chess_secret'); sec := 't3st'; end if;

  -- ================= lobby =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_create(26, 'white'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: buy-in over 25 accepted'; end if;
  denied := false; begin perform public.chess_create(-1, 'white'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: negative buy-in accepted'; end if;
  denied := false; begin perform public.chess_create(5, 'purple'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: bad color accepted'; end if;
  denied := false; begin perform public.chess_create(null, 'white'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: null buy-in accepted'; end if;
  j := public.chess_create(10, 'white');
  g := (j->>'game')::uuid;
  denied := false; begin perform public.chess_create(0, 'black'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: second open lobby accepted'; end if;
  denied := false; begin perform public.chess_join(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: joined own game'; end if;
  denied := false; begin insert into public.chess_games (household_id, host_id, buy_in) values (h1, a, 0); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct game insert allowed'; end if;
  reset role;
  select balance into ba from public.wallets where user_id = a;
  if ba <> 490 then raise exception 'FAIL: host stake not charged (%)', ba; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_join(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: outsider joined an H1 lobby'; end if;
  select count(*) into n from public.chess_games;
  if n <> 0 then raise exception 'FAIL: outsider sees H1 games'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_create(5, 'white'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: created a game without enough bingdons'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.chess_join(g);
  denied := false; begin perform public.chess_join(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: joined twice / started game'; end if;
  denied := false; begin perform public.chess_cancel(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: non-host cancelled / started game cancelled'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_join(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: joined a full game'; end if;
  reset role;
  select * into gm from public.chess_games where id = g;
  if gm.status <> 'playing' or gm.white_id <> a or gm.black_id <> b or gm.turn <> 'w' or gm.fen <> start_fen then raise exception 'FAIL: game did not start correctly'; end if;
  select balance into bb from public.wallets where user_id = b;
  if bb <> 490 then raise exception 'FAIL: joiner stake not charged (%)', bb; end if;

  -- ================= moves: secret gate =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; msg := null; begin perform public.chess_apply_move(null, g, 'e4', fen_b, '1. e4', 'none'); exception when others then denied := true; msg := sqlerrm; end;
  if not denied or msg <> 'forbidden' then raise exception 'FAIL: null secret accepted (%)', msg; end if;
  denied := false; msg := null; begin perform public.chess_apply_move('wrong', g, 'e4', fen_b, '1. e4', 'none'); exception when others then denied := true; msg := sqlerrm; end;
  if not denied or msg <> 'forbidden' then raise exception 'FAIL: wrong secret accepted (%)', msg; end if;
  denied := false; begin perform public.chess_apply_move(sec, g, 'e4', fen_b, '1. e4', 'bogus'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: bad outcome accepted'; end if;
  denied := false; begin perform public.chess_apply_move(sec, g, 'e4', fen_w, '1. e4', 'none'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: position with wrong side to move accepted'; end if;
  denied := false; begin perform public.chess_apply_move(sec, g, '', fen_b, '1. e4', 'none'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: empty move accepted'; end if;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  denied := false; begin perform public.chess_apply_move(sec, g, 'e4', fen_b, '1. e4', 'none'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: anon with the secret moved'; end if;
  denied := false; begin perform public.chess_join(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: anon can call chess_join'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_apply_move(sec, g, 'e5', fen_w, '1. e4 e5', 'none'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: black moved on white''s turn'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_apply_move(sec, g, 'e4', fen_b, '1. e4', 'none'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: outsider moved'; end if;
  denied := false; begin perform public.chess_resign(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: outsider resigned a game'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.chess_apply_move(sec, g, 'e4', fen_b, '1. e4', 'none');
  ev := (j->>'event')::uuid;
  select count(*) into n from public.push_targets('event', ev);
  if n <> 1 then raise exception 'FAIL: move push should reach the opponent device, got %', n; end if;
  if j->>'status' <> 'playing' then raise exception 'FAIL: status after normal move'; end if;
  reset role;
  select * into gm from public.chess_games where id = g;
  if gm.turn <> 'b' or gm.fen <> fen_b or gm.pgn <> '1. e4' then raise exception 'FAIL: move not stored'; end if;

  -- ================= draw offers =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_decline_draw(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: declined a nonexistent offer'; end if;
  perform public.chess_offer_draw(g);
  denied := false; begin perform public.chess_offer_draw(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: double offer'; end if;
  denied := false; begin perform public.chess_accept_draw(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: accepted own offer'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.chess_decline_draw(g);
  reset role;
  if (select draw_offered_by from public.chess_games where id = g) is not null then raise exception 'FAIL: decline did not clear the offer'; end if;
  set local role authenticated;
  perform public.chess_offer_draw(g);
  perform public.chess_apply_move(sec, g, 'e5', fen_w, '1. e4 e5', 'none');       -- the next move clears the offer
  reset role;
  if (select draw_offered_by from public.chess_games where id = g) is not null then raise exception 'FAIL: move did not clear the draw offer'; end if;

  -- ================= checkmate pays the pot exactly once =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_claim_idle(g); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: idle claim on my own move / too early'; end if;
  j := public.chess_apply_move(sec, g, 'Qh5#', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2', '1. e4 e5 2. Qh5#', 'checkmate');
  if j->>'status' <> 'finished' then raise exception 'FAIL: checkmate did not finish the game'; end if;
  denied := false; begin perform public.chess_apply_move(sec, g, 'Kd8', fen_w, '1. e4 e5 2. Qh5# Kd8', 'none'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: move accepted after the game finished'; end if;
  reset role;
  select * into gm from public.chess_games where id = g;
  if gm.result <> 'white' or gm.reason <> 'checkmate' or gm.finished_at is null then raise exception 'FAIL: checkmate result'; end if;
  select balance into ba from public.wallets where user_id = a;
  select balance into bb from public.wallets where user_id = b;
  if ba <> 510 or bb <> 490 then raise exception 'FAIL: pot not paid correctly (a %, b %)', ba, bb; end if;
  perform public.chess_finish(g, 'white', 'checkmate'); perform public.chess_finish(g, 'black', 'resignation');
  select count(*) into n from public.ledger_entries where idempotency_key like 'chess:' || g || ':%';
  if n <> 3 then raise exception 'FAIL: expected 2 stakes + 1 win ledger rows, got %', n; end if;
  select balance into ba from public.wallets where user_id = a;
  if ba <> 510 then raise exception 'FAIL: finishing twice paid twice'; end if;
  set local role authenticated;
  denied := false; begin perform public.chess_finish(g, 'white', 'x'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: clients can call the internal finish'; end if;
  reset role;

  -- ================= stalemate draw (random colors) refunds both =================
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g2 := (public.chess_create(5, 'random')->>'game')::uuid;
  reset role;
  if (select white_id from public.chess_games where id = g2) is not null then raise exception 'FAIL: random colors decided before join'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.chess_join(g2);
  reset role;
  select * into gm from public.chess_games where id = g2;
  if gm.white_id is null or gm.black_id is null or gm.white_id = gm.black_id or gm.white_id not in (c, e) or gm.black_id not in (c, e) then raise exception 'FAIL: random color assignment'; end if;
  select balance into bc from public.wallets where user_id = c;
  select balance into be from public.wallets where user_id = e;
  if bc <> 495 or be <> 495 then raise exception 'FAIL: stakes for g2 (% %)', bc, be; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', gm.white_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.chess_apply_move(sec, g2, 'Qg6', 'k7/8/8/8/8/8/8/K7 b - - 0 1', '1. Qg6', 'stalemate');
  reset role;
  select * into gm from public.chess_games where id = g2;
  if gm.status <> 'finished' or gm.result <> 'draw' then raise exception 'FAIL: stalemate not a draw'; end if;
  select balance into bc from public.wallets where user_id = c;
  select balance into be from public.wallets where user_id = e;
  if bc <> 500 or be <> 500 then raise exception 'FAIL: draw did not refund both (% %)', bc, be; end if;
  perform public.chess_finish(g2, 'draw', 'draw');
  select count(*) into n from public.ledger_entries where idempotency_key like 'chess:' || g2 || ':refund:%';
  if n <> 2 then raise exception 'FAIL: expected 2 refund rows, got %', n; end if;

  -- ================= free game: draw by agreement; no ledger rows =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g3 := (public.chess_create(0, 'black')->>'game')::uuid;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.chess_join(g3);
  perform public.chess_offer_draw(g3);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.chess_accept_draw(g3);
  denied := false; begin perform public.chess_resign(g3); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: resigned a finished game'; end if;
  reset role;
  select * into gm from public.chess_games where id = g3;
  if gm.white_id <> b or gm.black_id <> a or gm.result <> 'draw' or gm.reason <> 'agreement' then raise exception 'FAIL: g3 outcome'; end if;
  select count(*) into n from public.ledger_entries where idempotency_key like 'chess:' || g3 || ':%';
  if n <> 0 then raise exception 'FAIL: free game wrote ledger rows'; end if;

  -- ================= resign =================
  select balance into bc from public.wallets where user_id = c;
  select balance into ba from public.wallets where user_id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g4 := (public.chess_create(5, 'black')->>'game')::uuid;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.chess_join(g4);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_resign(g4); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: non-player resigned'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.chess_resign(g4);
  reset role;
  select * into gm from public.chess_games where id = g4;
  if gm.result <> 'white' or gm.reason <> 'resignation' then raise exception 'FAIL: resign result'; end if;
  if (select balance from public.wallets where user_id = a) <> ba + 5 then raise exception 'FAIL: resign winner not paid the pot'; end if;
  if (select balance from public.wallets where user_id = c) <> bc - 5 then raise exception 'FAIL: resign loser balance'; end if;

  -- ================= idle claim =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g5 := (public.chess_create(0, 'white')->>'game')::uuid;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.chess_join(g5);
  denied := false; begin perform public.chess_claim_idle(g5); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: idle claim accepted immediately'; end if;
  reset role;
  update public.chess_games set last_move_at = now() - interval '71 hours' where id = g5;
  set local role authenticated;
  denied := false; begin perform public.chess_claim_idle(g5); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: idle claim accepted at 71h'; end if;
  reset role;
  update public.chess_games set last_move_at = now() - interval '73 hours' where id = g5;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_claim_idle(g5); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: claimed idle win on own move'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.chess_claim_idle(g5);
  reset role;
  select * into gm from public.chess_games where id = g5;
  if gm.result <> 'black' or gm.reason <> 'timeout' then raise exception 'FAIL: idle claim result'; end if;

  -- ================= cancel =================
  select balance into bb from public.wallets where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  g6 := (public.chess_create(10, 'random')->>'game')::uuid;
  reset role;
  if (select balance from public.wallets where user_id = b) <> bb - 10 then raise exception 'FAIL: lobby stake'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_cancel(g6); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: non-host cancelled'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.chess_cancel(g6);
  denied := false; begin perform public.chess_cancel(g6); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: cancelled twice'; end if;
  reset role;
  if (select balance from public.wallets where user_id = b) <> bb then raise exception 'FAIL: cancel did not refund the host'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.chess_join(g6); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: joined a cancelled lobby'; end if;
  reset role;

  -- ================= privacy and direct writes =================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin update public.chess_games set result = 'white', status = 'finished' where id = g5; get diagnostics n = row_count; if n = 0 then denied := true; end if; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: players can edit games'; end if;
  denied := false; begin update public.chess_games set fen = 'x' where id = g; get diagnostics n = row_count; if n = 0 then denied := true; end if; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: players can edit the fen directly'; end if;
  denied := false; begin delete from public.chess_games; get diagnostics n = row_count; if n = 0 then denied := true; end if; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: games deletable'; end if;
  select count(*) into n from public.chess_games;
  if n < 6 then raise exception 'FAIL: housemate cannot read games (%)', n; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.chess_games;
  if n <> 0 then raise exception 'FAIL: outsider sees games'; end if;
  reset role;

  -- ================= conservation =================
  for w in select wl.user_id, wl.balance, (select coalesce(sum(amount), 0) from public.ledger_entries l where l.user_id = wl.user_id) s
           from public.wallets wl where wl.household_id in (h1, h3) loop
    if w.balance <> w.s then raise exception 'FAIL: wallet % != ledger %', w.balance, w.s; end if;
    if w.balance < 0 then raise exception 'FAIL: negative balance'; end if;
  end loop;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
