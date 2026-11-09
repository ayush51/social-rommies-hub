-- A local variable named seat clashed with the seat column.
create or replace function public.monopoly_join(p_game uuid) returns jsonb
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

