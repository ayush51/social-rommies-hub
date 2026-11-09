-- Abingdon Street: a Monopoly-style board game. Play money is "bucks"; bingdons are only the buy-in/pot.
-- Every rule runs in the database (server-rolled dice), so nothing can be faked from the client.

alter table public.ledger_entries drop constraint ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in ('starting', 'daily', 'tip_out', 'tip_in', 'game', 'poll', 'adjustment', 'bet_out', 'bet_payout', 'bet_refund',
                  'game_stake', 'game_refund', 'game_win'));

create table public.monopoly_spaces (
  idx int primary key check (idx between 0 and 39),
  kind text not null check (kind in ('start', 'property', 'station', 'utility', 'tax', 'card', 'jail', 'parking', 'gotojail')),
  name text not null,
  color text,
  price int,
  rent int[],
  upgrade_cost int,
  amount int
);
insert into public.monopoly_spaces (idx, kind, name, color, price, rent, upgrade_cost, amount) values
  (0, 'start', 'Start', null, null, null, null, null),
  (1, 'property', 'The Stoop', 'brown', 60, array[2,10,30,90], 50, null),
  (2, 'card', 'House Fund', null, null, null, null, null),
  (3, 'property', 'Basement Studio', 'brown', 60, array[4,20,60,180], 50, null),
  (4, 'tax', 'Rent Day', null, null, null, null, 200),
  (5, 'station', 'North Line', null, 200, null, null, null),
  (6, 'property', 'Corner Bodega', 'lightblue', 100, array[6,30,90,270], 50, null),
  (7, 'card', 'Wild Card', null, null, null, null, null),
  (8, 'property', 'Laundromat', 'lightblue', 100, array[6,30,90,270], 50, null),
  (9, 'property', 'Bike Shop', 'lightblue', 120, array[8,40,100,300], 50, null),
  (10, 'jail', 'The Couch', null, null, null, null, null),
  (11, 'property', 'Pizza Slice Shop', 'pink', 140, array[10,50,150,450], 100, null),
  (12, 'utility', 'Power Company', null, 150, null, null, null),
  (13, 'property', 'Taco Truck', 'pink', 140, array[10,50,150,450], 100, null),
  (14, 'property', 'Noodle Bar', 'pink', 160, array[12,60,180,500], 100, null),
  (15, 'station', 'East Line', null, 200, null, null, null),
  (16, 'property', 'Record Store', 'orange', 180, array[14,70,200,550], 100, null),
  (17, 'card', 'House Fund', null, null, null, null, null),
  (18, 'property', 'Skate Park', 'orange', 180, array[14,70,200,550], 100, null),
  (19, 'property', 'Arcade', 'orange', 200, array[16,80,220,600], 100, null),
  (20, 'parking', 'Free Parking', null, null, null, null, null),
  (21, 'property', 'Rooftop Bar', 'red', 220, array[18,90,250,700], 150, null),
  (22, 'card', 'Wild Card', null, null, null, null, null),
  (23, 'property', 'Brewery', 'red', 220, array[18,90,250,700], 150, null),
  (24, 'property', 'Comedy Club', 'red', 240, array[20,100,300,750], 150, null),
  (25, 'station', 'South Line', null, 200, null, null, null),
  (26, 'property', 'Farmers Market', 'yellow', 260, array[22,110,330,800], 150, null),
  (27, 'property', 'Food Court', 'yellow', 260, array[22,110,330,800], 150, null),
  (28, 'utility', 'Water Works', null, 150, null, null, null),
  (29, 'property', 'Ice Cream Parlor', 'yellow', 280, array[24,120,360,850], 150, null),
  (30, 'gotojail', 'Go to the Couch', null, null, null, null, null),
  (31, 'property', 'City Park', 'green', 300, array[26,130,390,900], 200, null),
  (32, 'property', 'Botanical Garden', 'green', 300, array[26,130,390,900], 200, null),
  (33, 'card', 'House Fund', null, null, null, null, null),
  (34, 'property', 'Riverside Dock', 'green', 320, array[28,150,450,1000], 200, null),
  (35, 'station', 'West Line', null, 200, null, null, null),
  (36, 'card', 'Wild Card', null, null, null, null, null),
  (37, 'property', 'Skyline Loft', 'blue', 350, array[35,175,500,1100], 200, null),
  (38, 'tax', 'Luxury Fee', null, null, null, null, 100),
  (39, 'property', '205 Abingdon St', 'blue', 400, array[50,200,600,1400], 200, null);
alter table public.monopoly_spaces enable row level security;
create policy "everyone reads the board" on public.monopoly_spaces for select to authenticated using (true);
revoke insert, update, delete, truncate on public.monopoly_spaces from anon, authenticated;

create table public.monopoly_games (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  host_id uuid not null references public.profiles(id),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'cancelled')),
  buy_in int not null check (buy_in between 0 and 25),
  max_players int not null check (max_players between 2 and 6),
  current_seat int,
  turn_phase text not null default 'roll' check (turn_phase in ('roll', 'buy', 'end')),
  turn_no int not null default 0,
  doubles int not null default 0,
  last_dice int[],
  turn_started_at timestamptz,
  winner_id uuid references public.profiles(id),
  last_actor uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on public.monopoly_games (household_id, created_at desc);

create table public.monopoly_players (
  game_id uuid not null references public.monopoly_games(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  household_id uuid not null references public.households(id) on delete cascade,
  seat int not null,
  cash int not null default 1500 check (cash >= 0),
  position int not null default 0 check (position between 0 and 39),
  in_jail boolean not null default false,
  jail_turns int not null default 0,
  bankrupt boolean not null default false,
  idle_skips int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id),
  unique (game_id, seat)
);
create index on public.monopoly_players (household_id);

create table public.monopoly_props (
  game_id uuid not null references public.monopoly_games(id) on delete cascade,
  space int not null references public.monopoly_spaces(idx),
  owner_id uuid not null references public.profiles(id),
  household_id uuid not null references public.households(id) on delete cascade,
  level int not null default 0 check (level between 0 and 3),
  primary key (game_id, space)
);
create index on public.monopoly_props (household_id);

create table public.monopoly_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  game_id uuid not null references public.monopoly_games(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  actor uuid references public.profiles(id),
  text text not null,
  notify_mode text not null default 'none' check (notify_mode in ('none', 'user', 'house')),
  notify_user uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.monopoly_events (game_id, seq desc);

alter table public.monopoly_games enable row level security;
alter table public.monopoly_players enable row level security;
alter table public.monopoly_props enable row level security;
alter table public.monopoly_events enable row level security;
create policy "members read games" on public.monopoly_games for select using (public.is_household_member(household_id));
create policy "members read players" on public.monopoly_players for select using (public.is_household_member(household_id));
create policy "members read props" on public.monopoly_props for select using (public.is_household_member(household_id));
create policy "members read events" on public.monopoly_events for select using (public.is_household_member(household_id));
revoke insert, update, delete, truncate on public.monopoly_games, public.monopoly_players, public.monopoly_props, public.monopoly_events from anon, authenticated;

-- ---------- helpers (internal: not callable by clients) ----------
create function public.mono_name(u uuid) returns text language sql stable security definer set search_path = '' as $$
  select display_name from public.profiles where id = u;
$$;

create function public.mono_log(p_game uuid, p_actor uuid, p_text text, p_mode text default 'none', p_user uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare ev uuid;
begin
  insert into public.monopoly_events (game_id, household_id, actor, text, notify_mode, notify_user)
  select id, household_id, p_actor, p_text, p_mode, p_user from public.monopoly_games where id = p_game returning id into ev;
  return ev;
end $$;

create function public.mono_advance(p_game uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gm public.monopoly_games; nxt int; nu uuid;
begin
  select * into gm from public.monopoly_games where id = p_game;
  select seat into nxt from public.monopoly_players where game_id = p_game and not bankrupt and seat > gm.current_seat order by seat limit 1;
  if nxt is null then select min(seat) into nxt from public.monopoly_players where game_id = p_game and not bankrupt; end if;
  update public.monopoly_games set current_seat = nxt, turn_phase = 'roll', doubles = 0, turn_no = turn_no + 1,
    turn_started_at = now(), updated_at = now() where id = p_game;
  select user_id into nu from public.monopoly_players where game_id = p_game and seat = nxt;
  return nu;
end $$;

create function public.mono_pass_turn(p_game uuid, p_actor uuid, p_text text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare nu uuid;
begin
  nu := public.mono_advance(p_game);
  return public.mono_log(p_game, p_actor, p_text || '. ' || public.mono_name(nu) || '''s turn.', 'user', nu);
end $$;

-- Pays a debt. If the debtor can't cover it they go bankrupt: everything goes to the creditor (or back to the bank).
create function public.mono_pay(p_game uuid, p_debtor uuid, p_creditor uuid, p_amount int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare c int;
begin
  select cash into c from public.monopoly_players where game_id = p_game and user_id = p_debtor for update;
  if c >= p_amount then
    update public.monopoly_players set cash = cash - p_amount where game_id = p_game and user_id = p_debtor;
    if p_creditor is not null then update public.monopoly_players set cash = cash + p_amount where game_id = p_game and user_id = p_creditor; end if;
    return true;
  end if;
  if p_creditor is not null then
    update public.monopoly_players set cash = cash + c where game_id = p_game and user_id = p_creditor;
    update public.monopoly_props set owner_id = p_creditor, level = 0 where game_id = p_game and owner_id = p_debtor;
  else
    delete from public.monopoly_props where game_id = p_game and owner_id = p_debtor;
  end if;
  update public.monopoly_players set cash = 0, bankrupt = true where game_id = p_game and user_id = p_debtor;
  return false;
end $$;

create function public.mono_finish_if_won(p_game uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gm public.monopoly_games; alive int; w uuid; pot int;
begin
  select * into gm from public.monopoly_games where id = p_game for update;
  if gm.status <> 'playing' then return null; end if;
  select count(*), min(user_id::text)::uuid into alive, w from public.monopoly_players where game_id = p_game and not bankrupt;
  if alive <> 1 then return null; end if;
  select gm.buy_in * count(*) into pot from public.monopoly_players where game_id = p_game;
  update public.monopoly_games set status = 'finished', winner_id = w, finished_at = now(), updated_at = now() where id = p_game;
  if pot > 0 then
    perform public.post_ledger(w, gm.household_id, pot, 'game_win', 'mono:' || p_game || ':win', p_game::text);
  end if;
  return public.mono_log(p_game, w, public.mono_name(w) || ' wins Abingdon Street' || case when pot > 0 then ' and takes the pot of ' || pot || ' bingdons' else '' end || '!', 'house');
end $$;

create function public.mono_after_bankrupt(p_game uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare ev uuid;
begin
  ev := public.mono_finish_if_won(p_game);
  if ev is not null then return ev; end if;
  return public.mono_pass_turn(p_game, p_user, public.mono_name(p_user) || ' is out of the game');
end $$;

create function public.mono_rent(p_game uuid, p_space int, p_owner uuid, p_dice int) returns int
language plpgsql stable security definer set search_path = '' as $$
declare sp public.monopoly_spaces; lvl int; owned int;
begin
  select * into sp from public.monopoly_spaces where idx = p_space;
  if sp.kind = 'property' then
    select level into lvl from public.monopoly_props where game_id = p_game and space = p_space;
    if lvl = 0 and not exists (
      select 1 from public.monopoly_spaces s2 where s2.color = sp.color and not exists (
        select 1 from public.monopoly_props p where p.game_id = p_game and p.space = s2.idx and p.owner_id = p_owner))
    then return sp.rent[1] * 2; end if;
    return sp.rent[lvl + 1];
  elsif sp.kind = 'station' then
    select count(*) into owned from public.monopoly_props where game_id = p_game and owner_id = p_owner and space in (5, 15, 25, 35);
    return 25 * (2 ^ (owned - 1))::int;
  else
    select count(*) into owned from public.monopoly_props where game_id = p_game and owner_id = p_owner and space in (12, 28);
    return p_dice * case when owned = 2 then 10 else 4 end;
  end if;
end $$;

create function public.mono_stake(p_game uuid, p_user uuid, p_hid uuid, p_amount int) returns void
language plpgsql security definer set search_path = '' as $$
declare bal bigint;
begin
  if p_amount = 0 then return; end if;
  perform public.ensure_wallet(p_user, p_hid);
  select balance into bal from public.wallets where user_id = p_user for update;
  if bal < p_amount then raise exception 'not enough bingdons for the buy-in'; end if;
  perform public.post_ledger(p_user, p_hid, -p_amount, 'game_stake', 'mono:' || p_game || ':stake:' || p_user, p_game::text);
end $$;

create function public.mono_refund(p_game uuid, p_user uuid, p_hid uuid, p_amount int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_amount = 0 then return; end if;
  perform public.post_ledger(p_user, p_hid, p_amount, 'game_refund', 'mono:' || p_game || ':refund:' || p_user, p_game::text);
end $$;

-- Locks the game + player rows and checks it is their move in the given phase(s).
create function public.mono_turn(p_game uuid, p_user uuid, p_phases text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare gm public.monopoly_games; pl public.monopoly_players;
begin
  select * into gm from public.monopoly_games where id = p_game for update;
  if not found or gm.status <> 'playing' then raise exception 'the game is not running'; end if;
  select * into pl from public.monopoly_players where game_id = p_game and user_id = p_user for update;
  if not found or pl.bankrupt then raise exception 'you are not playing'; end if;
  if pl.seat <> gm.current_seat then raise exception 'not your turn'; end if;
  if not gm.turn_phase = any(p_phases) then raise exception 'you cannot do that right now'; end if;
end $$;

-- ---------- turn actions (user passed in so tests can fix dice; clients only reach the wrappers below) ----------
create function public.mono_roll(p_game uuid, p_user uuid, d1 int, d2 int, p_card int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  gm public.monopoly_games; pl public.monopoly_players; sp public.monopoly_spaces; po public.monopoly_props;
  total int := d1 + d2; dbl boolean := (d1 = d2); newpos int; rent int; ok boolean := true; nm text; msg text;
  jail boolean := false; r record; ev uuid;
begin
  if d1 not between 1 and 6 or d2 not between 1 and 6 then raise exception 'bad dice'; end if;
  perform public.mono_turn(p_game, p_user, array['roll']);
  select * into gm from public.monopoly_games where id = p_game;
  select * into pl from public.monopoly_players where game_id = p_game and user_id = p_user;
  nm := public.mono_name(p_user);
  update public.monopoly_players set idle_skips = 0 where game_id = p_game and user_id = p_user;
  update public.monopoly_games set last_dice = array[d1, d2], last_actor = p_user, updated_at = now() where id = p_game;

  if pl.in_jail then
    if dbl then
      update public.monopoly_players set in_jail = false, jail_turns = 0 where game_id = p_game and user_id = p_user;
      perform public.mono_log(p_game, p_user, nm || ' rolled doubles and left the Couch');
      dbl := false;
    elsif pl.jail_turns + 1 >= 3 then
      if not public.mono_pay(p_game, p_user, null, 50) then
        perform public.mono_log(p_game, p_user, nm || ' could not pay the $50 fee to leave the Couch');
        return public.mono_after_bankrupt(p_game, p_user);
      end if;
      update public.monopoly_players set in_jail = false, jail_turns = 0 where game_id = p_game and user_id = p_user;
      perform public.mono_log(p_game, p_user, nm || ' paid $50 to leave the Couch');
    else
      update public.monopoly_players set jail_turns = jail_turns + 1 where game_id = p_game and user_id = p_user;
      return public.mono_pass_turn(p_game, p_user, nm || ' stayed on the Couch (' || (pl.jail_turns + 1) || ' of 3)');
    end if;
  elsif dbl then
    if gm.doubles + 1 >= 3 then
      update public.monopoly_players set position = 10, in_jail = true, jail_turns = 0 where game_id = p_game and user_id = p_user;
      return public.mono_pass_turn(p_game, p_user, nm || ' rolled three doubles in a row and went to the Couch');
    end if;
    update public.monopoly_games set doubles = gm.doubles + 1 where id = p_game;
  else
    update public.monopoly_games set doubles = 0 where id = p_game;
  end if;

  newpos := (pl.position + total) % 40;
  if pl.position + total >= 40 then
    update public.monopoly_players set cash = cash + 200 where game_id = p_game and user_id = p_user;
    perform public.mono_log(p_game, p_user, nm || ' passed Start and collected $200');
  end if;
  update public.monopoly_players set position = newpos where game_id = p_game and user_id = p_user;
  select * into sp from public.monopoly_spaces where idx = newpos;
  msg := nm || ' rolled ' || d1 || ' + ' || d2 || ' and landed on ' || sp.name;

  if sp.kind in ('property', 'station', 'utility') then
    select * into po from public.monopoly_props where game_id = p_game and space = newpos;
    if not found then
      update public.monopoly_games set turn_phase = 'buy', updated_at = now() where id = p_game;
      perform public.mono_log(p_game, p_user, msg || ' ($' || sp.price || ' to buy)');
      return null;
    elsif po.owner_id <> p_user then
      rent := public.mono_rent(p_game, newpos, po.owner_id, total);
      ok := public.mono_pay(p_game, p_user, po.owner_id, rent);
      msg := msg || case when ok then ' and paid ' || public.mono_name(po.owner_id) || ' $' || rent
                         else ' and could not afford the $' || rent || ' rent' end;
    end if;
  elsif sp.kind = 'tax' then
    ok := public.mono_pay(p_game, p_user, null, sp.amount);
    msg := msg || case when ok then ' and paid $' || sp.amount else ' and could not afford the $' || sp.amount end;
  elsif sp.kind = 'card' then
    case p_card
      when 0 then update public.monopoly_players set cash = cash + 100 where game_id = p_game and user_id = p_user; msg := msg || ': found $100 in an old coat';
      when 1 then update public.monopoly_players set cash = cash + 50 where game_id = p_game and user_id = p_user; msg := msg || ': sold a vintage lamp for $50';
      when 2 then ok := public.mono_pay(p_game, p_user, null, 50); msg := msg || ': surprise plumber bill of $50';
      when 3 then ok := public.mono_pay(p_game, p_user, null, 100); msg := msg || ': parking ticket of $100';
      when 4 then update public.monopoly_players set position = 0, cash = cash + 200 where game_id = p_game and user_id = p_user; msg := msg || ': advance to Start and collect $200';
      when 5 then jail := true; msg := msg || ': the landlord is not happy';
      when 6 then update public.monopoly_players set cash = cash + 150 where game_id = p_game and user_id = p_user; msg := msg || ': birthday money of $150';
      when 7 then
        msg := msg || ': host dinner, pay every roommate $25';
        for r in select user_id from public.monopoly_players where game_id = p_game and not bankrupt and user_id <> p_user order by seat loop
          ok := public.mono_pay(p_game, p_user, r.user_id, 25);
          exit when not ok;
        end loop;
      when 8 then
        msg := msg || ': game night, every roommate pays you $25';
        for r in select user_id from public.monopoly_players where game_id = p_game and not bankrupt and user_id <> p_user order by seat loop
          perform public.mono_pay(p_game, r.user_id, p_user, 25);
        end loop;
      else ok := public.mono_pay(p_game, p_user, null, 25); msg := msg || ': late fee of $25';
    end case;
  elsif sp.kind = 'gotojail' then
    jail := true;
  end if;

  if jail then
    update public.monopoly_players set position = 10, in_jail = true, jail_turns = 0 where game_id = p_game and user_id = p_user;
    msg := msg || ' and was sent to the Couch';
  end if;
  perform public.mono_log(p_game, p_user, msg);

  if not ok then return public.mono_after_bankrupt(p_game, p_user); end if;
  ev := public.mono_finish_if_won(p_game);
  if ev is not null then return ev; end if;
  if jail then return public.mono_pass_turn(p_game, p_user, nm || ' is on the Couch'); end if;
  if dbl then return null; end if;   -- doubles: roll again
  update public.monopoly_games set turn_phase = 'end', updated_at = now() where id = p_game;
  return null;
end $$;

create function public.mono_buy(p_game uuid, p_user uuid, p_buy boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gm public.monopoly_games; pl public.monopoly_players; sp public.monopoly_spaces; nm text := public.mono_name(p_user);
begin
  perform public.mono_turn(p_game, p_user, array['buy']);
  select * into gm from public.monopoly_games where id = p_game;
  select * into pl from public.monopoly_players where game_id = p_game and user_id = p_user;
  select * into sp from public.monopoly_spaces where idx = pl.position;
  if p_buy then
    if exists (select 1 from public.monopoly_props where game_id = p_game and space = pl.position) then raise exception 'already owned'; end if;
    if pl.cash < sp.price then raise exception 'not enough cash'; end if;
    update public.monopoly_players set cash = cash - sp.price where game_id = p_game and user_id = p_user;
    insert into public.monopoly_props (game_id, space, owner_id, household_id) values (p_game, pl.position, p_user, gm.household_id);
    perform public.mono_log(p_game, p_user, nm || ' bought ' || sp.name || ' for $' || sp.price);
  else
    perform public.mono_log(p_game, p_user, nm || ' passed on ' || sp.name);
  end if;
  update public.monopoly_games set turn_phase = case when gm.doubles > 0 then 'roll' else 'end' end, last_actor = p_user, updated_at = now() where id = p_game;
  return null;
end $$;

create function public.mono_end_turn(p_game uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform public.mono_turn(p_game, p_user, array['end']);
  update public.monopoly_games set last_actor = p_user where id = p_game;
  return public.mono_pass_turn(p_game, p_user, public.mono_name(p_user) || ' ended their turn');
end $$;

create function public.mono_upgrade(p_game uuid, p_user uuid, p_space int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gm public.monopoly_games; pl public.monopoly_players; sp public.monopoly_spaces; po public.monopoly_props; minlvl int;
begin
  perform public.mono_turn(p_game, p_user, array['roll', 'end']);
  select * into gm from public.monopoly_games where id = p_game;
  select * into pl from public.monopoly_players where game_id = p_game and user_id = p_user;
  select * into sp from public.monopoly_spaces where idx = p_space;
  if not found or sp.kind <> 'property' then raise exception 'that space cannot be upgraded'; end if;
  select * into po from public.monopoly_props where game_id = p_game and space = p_space;
  if not found or po.owner_id <> p_user then raise exception 'you do not own that'; end if;
  if exists (select 1 from public.monopoly_spaces s2 where s2.color = sp.color and not exists (
      select 1 from public.monopoly_props p where p.game_id = p_game and p.space = s2.idx and p.owner_id = p_user)) then
    raise exception 'you need the whole colour set first';
  end if;
  if po.level >= 3 then raise exception 'already fully upgraded'; end if;
  select min(p.level) into minlvl from public.monopoly_props p join public.monopoly_spaces s2 on s2.idx = p.space
    where p.game_id = p_game and s2.color = sp.color;
  if po.level > minlvl then raise exception 'upgrade the other properties in the set first'; end if;
  if pl.cash < sp.upgrade_cost then raise exception 'not enough cash'; end if;
  update public.monopoly_players set cash = cash - sp.upgrade_cost where game_id = p_game and user_id = p_user;
  update public.monopoly_props set level = level + 1 where game_id = p_game and space = p_space;
  update public.monopoly_games set last_actor = p_user, updated_at = now() where id = p_game;
  perform public.mono_log(p_game, p_user, public.mono_name(p_user) || ' upgraded ' || sp.name || ' to level ' || (po.level + 1) || ' for $' || sp.upgrade_cost);
  return null;
end $$;

create function public.mono_pay_jail(p_game uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gm public.monopoly_games; pl public.monopoly_players;
begin
  perform public.mono_turn(p_game, p_user, array['roll']);
  select * into gm from public.monopoly_games where id = p_game;
  select * into pl from public.monopoly_players where game_id = p_game and user_id = p_user;
  if not pl.in_jail then raise exception 'you are not on the Couch'; end if;
  if pl.cash < 50 then raise exception 'not enough cash'; end if;
  update public.monopoly_players set cash = cash - 50, in_jail = false, jail_turns = 0 where game_id = p_game and user_id = p_user;
  update public.monopoly_games set last_actor = p_user, updated_at = now() where id = p_game;
  perform public.mono_log(p_game, p_user, public.mono_name(p_user) || ' paid $50 to leave the Couch');
  return null;
end $$;

create function public.mono_resign(p_game uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gm public.monopoly_games; pl public.monopoly_players; ev uuid;
begin
  select * into gm from public.monopoly_games where id = p_game for update;
  if not found or gm.status <> 'playing' then raise exception 'the game is not running'; end if;
  select * into pl from public.monopoly_players where game_id = p_game and user_id = p_user for update;
  if not found or pl.bankrupt then raise exception 'you are not playing'; end if;
  update public.monopoly_players set bankrupt = true, cash = 0 where game_id = p_game and user_id = p_user;
  delete from public.monopoly_props where game_id = p_game and owner_id = p_user;
  update public.monopoly_games set last_actor = p_user, updated_at = now() where id = p_game;
  perform public.mono_log(p_game, p_user, public.mono_name(p_user) || ' resigned');
  ev := public.mono_finish_if_won(p_game);
  if ev is not null then return ev; end if;
  if pl.seat = gm.current_seat then return public.mono_pass_turn(p_game, p_user, public.mono_name(p_user) || ' resigned'); end if;
  return null;
end $$;

-- Anyone in the game can move things along if the current player has been idle for 24 hours; 3 skips in a row and they're out.
create function public.mono_skip(p_game uuid, p_caller uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gm public.monopoly_games; cur public.monopoly_players; idle int; ev uuid;
begin
  select * into gm from public.monopoly_games where id = p_game for update;
  if not found or gm.status <> 'playing' then raise exception 'the game is not running'; end if;
  if not exists (select 1 from public.monopoly_players where game_id = p_game and user_id = p_caller and not bankrupt) then raise exception 'you are not playing'; end if;
  select * into cur from public.monopoly_players where game_id = p_game and seat = gm.current_seat for update;
  if cur.user_id = p_caller then raise exception 'take your own turn'; end if;
  if gm.turn_started_at > now() - interval '24 hours' then raise exception 'they have not been idle for 24 hours yet'; end if;
  idle := cur.idle_skips + 1;
  update public.monopoly_games set last_actor = p_caller where id = p_game;
  if idle >= 3 then
    update public.monopoly_players set bankrupt = true, cash = 0, idle_skips = idle where game_id = p_game and user_id = cur.user_id;
    delete from public.monopoly_props where game_id = p_game and owner_id = cur.user_id;
    perform public.mono_log(p_game, p_caller, public.mono_name(cur.user_id) || ' was skipped 3 times and is out');
    ev := public.mono_finish_if_won(p_game);
    if ev is not null then return ev; end if;
    return public.mono_pass_turn(p_game, p_caller, public.mono_name(cur.user_id) || ' is out of the game');
  end if;
  update public.monopoly_players set idle_skips = idle where game_id = p_game and user_id = cur.user_id;
  return public.mono_pass_turn(p_game, p_caller, public.mono_name(cur.user_id) || ' was skipped (' || idle || ' of 3)');
end $$;

-- ---------- public API ----------
create function public.monopoly_create(p_buy_in int, p_max int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; g uuid; ev uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  if p_buy_in not between 0 and 25 then raise exception 'buy-in must be 0 to 25 bingdons'; end if;
  if p_max not between 2 and 6 then raise exception 'players must be 2 to 6'; end if;
  if exists (select 1 from public.monopoly_games where host_id = me and status = 'lobby') then raise exception 'you already have an open lobby'; end if;
  insert into public.monopoly_games (household_id, host_id, buy_in, max_players) values (hid, me, p_buy_in, p_max) returning id into g;
  insert into public.monopoly_players (game_id, user_id, household_id, seat) values (g, me, hid, 1);
  perform public.mono_stake(g, me, hid, p_buy_in);
  ev := public.mono_log(g, me, public.mono_name(me) || ' opened an Abingdon Street lobby' ||
    case when p_buy_in > 0 then ' (buy-in ' || p_buy_in || ' bingdons)' else ' (free)' end, 'house');
  return jsonb_build_object('game', g, 'event', ev);
end $$;

create function public.monopoly_join(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.monopoly_games; new_seat int; ev uuid;
begin
  select * into gm from public.monopoly_games where id = p_game for update;
  if not found or not public.is_household_member(gm.household_id) then raise exception 'not found'; end if;
  if gm.status <> 'lobby' then raise exception 'this game has already started'; end if;
  if exists (select 1 from public.monopoly_players where game_id = p_game and user_id = me) then raise exception 'you are already in'; end if;
  if (select count(*) from public.monopoly_players where game_id = p_game) >= gm.max_players then raise exception 'the lobby is full'; end if;
  select coalesce(max(seat), 0) + 1 into new_seat from public.monopoly_players where game_id = p_game;
  insert into public.monopoly_players (game_id, user_id, household_id, seat) values (p_game, me, gm.household_id, new_seat);
  perform public.mono_stake(p_game, me, gm.household_id, gm.buy_in);
  ev := public.mono_log(p_game, me, public.mono_name(me) || ' joined your lobby', 'user', gm.host_id);
  return jsonb_build_object('game', p_game, 'event', ev);
end $$;

create function public.monopoly_leave(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.monopoly_games;
begin
  select * into gm from public.monopoly_games where id = p_game for update;
  if not found or not public.is_household_member(gm.household_id) then raise exception 'not found'; end if;
  if gm.status <> 'lobby' then raise exception 'the game has started: resign instead'; end if;
  if gm.host_id = me then raise exception 'the host cancels the lobby instead'; end if;
  if not exists (select 1 from public.monopoly_players where game_id = p_game and user_id = me) then raise exception 'you are not in this lobby'; end if;
  delete from public.monopoly_players where game_id = p_game and user_id = me;
  perform public.mono_refund(p_game, me, gm.household_id, gm.buy_in);
  perform public.mono_log(p_game, me, public.mono_name(me) || ' left the lobby');
  return jsonb_build_object('game', p_game);
end $$;

create function public.monopoly_cancel(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.monopoly_games; p record;
begin
  select * into gm from public.monopoly_games where id = p_game for update;
  if not found or gm.host_id <> me then raise exception 'only the host can cancel'; end if;
  if gm.status <> 'lobby' then raise exception 'only a lobby can be cancelled'; end if;
  for p in select user_id from public.monopoly_players where game_id = p_game order by user_id loop
    perform public.mono_refund(p_game, p.user_id, gm.household_id, gm.buy_in);
  end loop;
  update public.monopoly_games set status = 'cancelled', finished_at = now(), updated_at = now() where id = p_game;
  perform public.mono_log(p_game, me, public.mono_name(me) || ' cancelled the lobby; buy-ins refunded');
  return jsonb_build_object('game', p_game);
end $$;

create function public.monopoly_start(p_game uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gm public.monopoly_games; first_seat int; first_user uuid; ev uuid;
begin
  select * into gm from public.monopoly_games where id = p_game for update;
  if not found or gm.host_id <> me then raise exception 'only the host can start'; end if;
  if gm.status <> 'lobby' then raise exception 'already started'; end if;
  if (select count(*) from public.monopoly_players where game_id = p_game) < 2 then raise exception 'need at least 2 players'; end if;
  select seat, user_id into first_seat, first_user from public.monopoly_players where game_id = p_game order by seat limit 1;
  update public.monopoly_games set status = 'playing', current_seat = first_seat, turn_phase = 'roll', turn_no = 1,
    started_at = now(), turn_started_at = now(), last_actor = me, updated_at = now() where id = p_game;
  ev := public.mono_log(p_game, me, 'The game is on! ' || public.mono_name(first_user) || ' rolls first.', 'house');
  return jsonb_build_object('game', p_game, 'event', ev);
end $$;

create function public.monopoly_roll(p_game uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return jsonb_build_object('event', public.mono_roll(p_game, auth.uid(), 1 + floor(random() * 6)::int, 1 + floor(random() * 6)::int, floor(random() * 10)::int));
end $$;
create function public.monopoly_buy(p_game uuid, p_buy boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return jsonb_build_object('event', public.mono_buy(p_game, auth.uid(), p_buy));
end $$;
create function public.monopoly_end_turn(p_game uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return jsonb_build_object('event', public.mono_end_turn(p_game, auth.uid()));
end $$;
create function public.monopoly_upgrade(p_game uuid, p_space int) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return jsonb_build_object('event', public.mono_upgrade(p_game, auth.uid(), p_space));
end $$;
create function public.monopoly_pay_jail(p_game uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return jsonb_build_object('event', public.mono_pay_jail(p_game, auth.uid()));
end $$;
create function public.monopoly_resign(p_game uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return jsonb_build_object('event', public.mono_resign(p_game, auth.uid()));
end $$;
create function public.monopoly_skip(p_game uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return jsonb_build_object('event', public.mono_skip(p_game, auth.uid()));
end $$;

revoke all on function public.mono_name, public.mono_log, public.mono_advance, public.mono_pass_turn, public.mono_pay, public.mono_finish_if_won,
  public.mono_after_bankrupt, public.mono_rent, public.mono_stake, public.mono_refund, public.mono_turn, public.mono_roll, public.mono_buy,
  public.mono_end_turn, public.mono_upgrade, public.mono_pay_jail, public.mono_resign, public.mono_skip from public, anon, authenticated;
revoke all on function public.monopoly_create, public.monopoly_join, public.monopoly_leave, public.monopoly_cancel, public.monopoly_start,
  public.monopoly_roll, public.monopoly_buy, public.monopoly_end_turn, public.monopoly_upgrade, public.monopoly_pay_jail,
  public.monopoly_resign, public.monopoly_skip from public, anon;
grant execute on function public.monopoly_create, public.monopoly_join, public.monopoly_leave, public.monopoly_cancel, public.monopoly_start,
  public.monopoly_roll, public.monopoly_buy, public.monopoly_end_turn, public.monopoly_upgrade, public.monopoly_pay_jail,
  public.monopoly_resign, public.monopoly_skip to authenticated;

-- push: game events ("your turn", "lobby opened", winner)
create or replace function public.push_targets(p_kind text, p_ref uuid)
returns table (endpoint text, p256dh text, auth text, title text, body text, url text)
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; who text; t text; b text; u text; n int; nu uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select display_name into who from public.profiles where id = me;

  if p_kind = 'message' then
    select m.household_id, who, left(coalesce(nullif(m.body, ''), 'Sent a photo'), 140),
           case when m.recipient_id is null then '/chat' else '/chat/dm/' || me end, m.recipient_id
      into hid, t, b, u, nu
    from public.messages m where m.id = p_ref and m.user_id = me and m.created_at > now() - interval '2 minutes';
  elsif p_kind = 'plan' then
    select p.household_id, 'New plan', who || ': ' || p.title, '/plans/' || p.id into hid, t, b, u
    from public.plans p where p.id = p_ref and p.created_by = me and p.created_at > now() - interval '2 minutes';
  elsif p_kind = 'post' then
    select d.household_id, who || ' posted today''s photo', coalesce(d.caption, 'Take a look'), '/daily' into hid, t, b, u
    from public.daily_posts d where d.id = p_ref and d.user_id = me and d.created_at > now() - interval '2 minutes';
  elsif p_kind = 'rally' then
    select r.household_id, who || ' is rallying the house', r.label || '. Who''s in?', '/' into hid, t, b, u
    from public.rallies r where r.id = p_ref and r.user_id = me and r.created_at > now() - interval '2 minutes';
  elsif p_kind = 'market' then
    select k.household_id, who || ' started a prediction', k.question, '/predictions/' || k.id into hid, t, b, u
    from public.markets k where k.id = p_ref and k.created_by = me and k.created_at > now() - interval '2 minutes';
  elsif p_kind = 'game' then
    select e.household_id, case when e.notify_mode = 'user' then 'Abingdon Street' else 'Abingdon Street' end, e.text,
           '/games/monopoly/' || e.game_id, case when e.notify_mode = 'user' then e.notify_user end
      into hid, t, b, u, nu
    from public.monopoly_events e
    where e.id = p_ref and e.actor = me and e.notify_mode <> 'none' and e.created_at > now() - interval '2 minutes';
  else
    raise exception 'unknown kind';
  end if;
  if hid is null then return; end if;

  insert into public.push_log (ref) values (p_kind || ':' || p_ref) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return; end if;

  return query
    select s.endpoint, s.p256dh, s.auth, t, b, u
    from public.push_subscriptions s
    where s.household_id = hid and s.user_id <> me and (nu is null or s.user_id = nu);
end $$;

alter publication supabase_realtime add table public.monopoly_games, public.monopoly_players, public.monopoly_props, public.monopoly_events;
