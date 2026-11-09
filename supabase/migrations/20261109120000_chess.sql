-- Chess: async two-player games with an optional bingdon buy-in.
-- Move legality is checked by chess.js in a Next.js server action, which then calls chess_apply_move with a Vault secret
-- (chess_secret). A browser calling the RPC directly does not know the secret, so it cannot submit illegal moves.

create table public.chess_games (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  host_id uuid not null references public.profiles(id),
  white_id uuid references public.profiles(id),
  black_id uuid references public.profiles(id),
  host_color text not null default 'random' check (host_color in ('white', 'black', 'random')),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'cancelled')),
  buy_in int not null check (buy_in between 0 and 25),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  turn text not null default 'w' check (turn in ('w', 'b')),
  result text check (result in ('white', 'black', 'draw')),
  reason text,
  draw_offered_by uuid references public.profiles(id),
  last_move_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on public.chess_games (household_id, created_at desc);
create unique index chess_one_open_lobby on public.chess_games (host_id) where status = 'lobby';

alter table public.chess_games enable row level security;
create policy "members read chess games" on public.chess_games for select using (public.is_household_member(household_id));
revoke insert, update, delete, truncate on public.chess_games from anon, authenticated;

-- ---------- internal helpers (not callable by clients) ----------
create function public.chess_name(u uuid) returns text language sql stable security definer set search_path = '' as $$
  select display_name from public.profiles where id = u;
$$;

create function public.chess_stake(p_game uuid, p_user uuid, p_hid uuid, p_amount int) returns void
language plpgsql security definer set search_path = '' as $$
declare bal bigint;
begin
  if p_amount = 0 then return; end if;
  perform public.ensure_wallet(p_user, p_hid);
  select balance into bal from public.wallets where user_id = p_user for update;
  if bal < p_amount then raise exception 'not enough bingdons for the buy-in'; end if;
  perform public.post_ledger(p_user, p_hid, -p_amount, 'game_stake', 'chess:' || p_game || ':stake:' || p_user, p_game::text);
end $$;

create function public.chess_refund(p_game uuid, p_user uuid, p_hid uuid, p_amount int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_amount = 0 then return; end if;
  perform public.post_ledger(p_user, p_hid, p_amount, 'game_refund', 'chess:' || p_game || ':refund:' || p_user, p_game::text);
end $$;

-- Ends a running game exactly once and settles the pot. p_result: 'white' | 'black' | 'draw'.
create function public.chess_finish(p_game uuid, p_result text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare gm public.chess_games; w uuid;
begin
  select * into gm from public.chess_games where id = p_game for update;
  if not found or gm.status <> 'playing' then return; end if;
  update public.chess_games set status = 'finished', result = p_result, reason = p_reason, draw_offered_by = null,
    finished_at = now(), updated_at = now() where id = p_game;
  if gm.buy_in = 0 then return; end if;
  if p_result = 'draw' then
    perform public.chess_refund(p_game, gm.white_id, gm.household_id, gm.buy_in);
    perform public.chess_refund(p_game, gm.black_id, gm.household_id, gm.buy_in);
  else
    w := case when p_result = 'white' then gm.white_id else gm.black_id end;
    perform public.post_ledger(w, gm.household_id, gm.buy_in * 2, 'game_win', 'chess:' || p_game || ':win', p_game::text);
  end if;
end $$;

-- ---------- lobby ----------
create function public.chess_create(p_buy_in int, p_color text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; g uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  if p_buy_in is null or p_buy_in not between 0 and 25 then raise exception 'buy-in must be 0 to 25 bingdons'; end if;
  if p_color is null or p_color not in ('white', 'black', 'random') then raise exception 'pick white, black or random'; end if;
  if exists (select 1 from public.chess_games where host_id = me and status = 'lobby') then raise exception 'you already have an open lobby'; end if;
  insert into public.chess_games (household_id, host_id, buy_in, host_color, white_id, black_id)
  values (hid, me, p_buy_in, p_color, case when p_color = 'white' then me end, case when p_color = 'black' then me end)
  returning id into g;
  perform public.chess_stake(g, me, hid, p_buy_in);
  return jsonb_build_object('game', g);
end $$;

create function public.chess_join(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.chess_games; host_white boolean; w uuid; b uuid; ev uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into gm from public.chess_games where id = p_game for update;
  if not found or not public.is_household_member(gm.household_id) then raise exception 'not found'; end if;
  if gm.status <> 'lobby' then raise exception 'this game has already started'; end if;
  if gm.host_id = me then raise exception 'you cannot join your own game'; end if;
  host_white := case gm.host_color when 'white' then true when 'black' then false else random() < 0.5 end;
  w := case when host_white then gm.host_id else me end;
  b := case when host_white then me else gm.host_id end;
  perform public.chess_stake(p_game, me, gm.household_id, gm.buy_in);
  update public.chess_games set white_id = w, black_id = b, status = 'playing', turn = 'w',
    started_at = now(), last_move_at = now(), updated_at = now() where id = p_game;
  ev := public.emit_push_event(gm.household_id, me, 'chess', 'Chess game on', public.chess_name(me) || ' joined your game'
    || case when host_white then '. You play white, your move.' else '. You play black.' end, '/games/chess/' || p_game, gm.host_id);
  return jsonb_build_object('game', p_game, 'event', ev);
end $$;

create function public.chess_cancel(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.chess_games;
begin
  select * into gm from public.chess_games where id = p_game for update;
  if not found or gm.host_id <> me then raise exception 'only the host can cancel'; end if;
  if gm.status <> 'lobby' then raise exception 'only a lobby can be cancelled'; end if;
  perform public.chess_refund(p_game, me, gm.household_id, gm.buy_in);
  update public.chess_games set status = 'cancelled', finished_at = now(), updated_at = now() where id = p_game;
  return jsonb_build_object('game', p_game);
end $$;

-- ---------- moves (secret-gated) ----------
create function public.chess_apply_move(p_secret text, p_game uuid, p_san text, p_fen text, p_pgn text, p_outcome text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.chess_games; mover uuid; opp uuid; ev uuid; nm text; res text;
begin
  if not private.secret_ok('chess_secret', p_secret) then raise exception 'forbidden'; end if;
  if me is null then raise exception 'not authenticated'; end if;
  if p_outcome is null or p_outcome not in ('none', 'checkmate', 'stalemate', 'draw') then raise exception 'bad outcome'; end if;
  if p_san is null or p_san = '' or p_fen is null or p_fen = '' or p_pgn is null or p_pgn = '' then raise exception 'bad move'; end if;
  select * into gm from public.chess_games where id = p_game for update;
  if not found or not public.is_household_member(gm.household_id) then raise exception 'not found'; end if;
  if gm.status <> 'playing' then raise exception 'the game is not running'; end if;
  mover := case gm.turn when 'w' then gm.white_id else gm.black_id end;
  if mover is distinct from me then raise exception 'not your turn'; end if;
  if split_part(p_fen, ' ', 2) is distinct from (case gm.turn when 'w' then 'b' else 'w' end) then raise exception 'bad position'; end if;
  opp := case gm.turn when 'w' then gm.black_id else gm.white_id end;
  nm := public.chess_name(me);

  update public.chess_games set fen = p_fen, pgn = p_pgn, turn = case gm.turn when 'w' then 'b' else 'w' end,
    draw_offered_by = null, last_move_at = now(), updated_at = now() where id = p_game;

  if p_outcome = 'checkmate' then
    res := case gm.turn when 'w' then 'white' else 'black' end;
    perform public.chess_finish(p_game, res, 'checkmate');
    ev := public.emit_push_event(gm.household_id, me, 'chess', 'Checkmate', nm || ' won by checkmate (' || p_san || ')', '/games/chess/' || p_game, opp);
  elsif p_outcome in ('stalemate', 'draw') then
    perform public.chess_finish(p_game, 'draw', p_outcome);
    ev := public.emit_push_event(gm.household_id, me, 'chess', 'Chess draw', 'Draw by ' || case p_outcome when 'stalemate' then 'stalemate' else 'repetition or no material' end,
      '/games/chess/' || p_game, opp);
  else
    ev := public.emit_push_event(gm.household_id, me, 'chess', 'Your move vs ' || nm, nm || ' played ' || p_san, '/games/chess/' || p_game, opp);
  end if;
  return jsonb_build_object('game', p_game, 'event', ev, 'status', (select status from public.chess_games where id = p_game));
end $$;

-- ---------- other actions ----------
create function public.chess_resign(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.chess_games; ev uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into gm from public.chess_games where id = p_game for update;
  if not found or (me is distinct from gm.white_id and me is distinct from gm.black_id) then raise exception 'you are not playing'; end if;
  if gm.status <> 'playing' then raise exception 'the game is not running'; end if;
  perform public.chess_finish(p_game, case when me = gm.white_id then 'black' else 'white' end, 'resignation');
  ev := public.emit_push_event(gm.household_id, me, 'chess', 'Chess game over', public.chess_name(me) || ' resigned',
    '/games/chess/' || p_game, case when me = gm.white_id then gm.black_id else gm.white_id end);
  return jsonb_build_object('game', p_game, 'event', ev);
end $$;

create function public.chess_offer_draw(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.chess_games; ev uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into gm from public.chess_games where id = p_game for update;
  if not found or (me is distinct from gm.white_id and me is distinct from gm.black_id) then raise exception 'you are not playing'; end if;
  if gm.status <> 'playing' then raise exception 'the game is not running'; end if;
  if gm.draw_offered_by is not null then raise exception 'a draw offer is already pending'; end if;
  update public.chess_games set draw_offered_by = me, updated_at = now() where id = p_game;
  ev := public.emit_push_event(gm.household_id, me, 'chess', 'Draw offered', public.chess_name(me) || ' offers a draw',
    '/games/chess/' || p_game, case when me = gm.white_id then gm.black_id else gm.white_id end);
  return jsonb_build_object('game', p_game, 'event', ev);
end $$;

create function public.chess_accept_draw(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.chess_games; ev uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into gm from public.chess_games where id = p_game for update;
  if not found or (me is distinct from gm.white_id and me is distinct from gm.black_id) then raise exception 'you are not playing'; end if;
  if gm.status <> 'playing' then raise exception 'the game is not running'; end if;
  if gm.draw_offered_by is null or gm.draw_offered_by = me then raise exception 'there is no draw offer to accept'; end if;
  perform public.chess_finish(p_game, 'draw', 'agreement');
  ev := public.emit_push_event(gm.household_id, me, 'chess', 'Draw agreed', public.chess_name(me) || ' accepted the draw',
    '/games/chess/' || p_game, gm.draw_offered_by);
  return jsonb_build_object('game', p_game, 'event', ev);
end $$;

create function public.chess_decline_draw(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.chess_games; ev uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into gm from public.chess_games where id = p_game for update;
  if not found or (me is distinct from gm.white_id and me is distinct from gm.black_id) then raise exception 'you are not playing'; end if;
  if gm.status <> 'playing' then raise exception 'the game is not running'; end if;
  if gm.draw_offered_by is null or gm.draw_offered_by = me then raise exception 'there is no draw offer to decline'; end if;
  update public.chess_games set draw_offered_by = null, updated_at = now() where id = p_game;
  ev := public.emit_push_event(gm.household_id, me, 'chess', 'Draw declined', public.chess_name(me) || ' declined your draw offer',
    '/games/chess/' || p_game, gm.draw_offered_by);
  return jsonb_build_object('game', p_game, 'event', ev);
end $$;

create function public.chess_claim_idle(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.chess_games; ev uuid; opp uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into gm from public.chess_games where id = p_game for update;
  if not found or (me is distinct from gm.white_id and me is distinct from gm.black_id) then raise exception 'you are not playing'; end if;
  if gm.status <> 'playing' then raise exception 'the game is not running'; end if;
  opp := case when me = gm.white_id then gm.black_id else gm.white_id end;
  if (case gm.turn when 'w' then gm.white_id else gm.black_id end) = me then raise exception 'it is your own move'; end if;
  if now() - gm.last_move_at < interval '72 hours' then raise exception 'your opponent still has time to move'; end if;
  perform public.chess_finish(p_game, case when me = gm.white_id then 'white' else 'black' end, 'timeout');
  ev := public.emit_push_event(gm.household_id, me, 'chess', 'Chess game over', public.chess_name(me) || ' claimed the win after 72 idle hours',
    '/games/chess/' || p_game, opp);
  return jsonb_build_object('game', p_game, 'event', ev);
end $$;

revoke all on function public.chess_name, public.chess_stake, public.chess_refund, public.chess_finish from public, anon, authenticated;
revoke all on function public.chess_create, public.chess_join, public.chess_cancel, public.chess_resign, public.chess_offer_draw,
  public.chess_accept_draw, public.chess_decline_draw, public.chess_claim_idle from public, anon;
grant execute on function public.chess_create, public.chess_join, public.chess_cancel, public.chess_resign, public.chess_offer_draw,
  public.chess_accept_draw, public.chess_decline_draw, public.chess_claim_idle to authenticated;
revoke all on function public.chess_apply_move from public;
grant execute on function public.chess_apply_move to anon, authenticated;

alter publication supabase_realtime add table public.chess_games;
