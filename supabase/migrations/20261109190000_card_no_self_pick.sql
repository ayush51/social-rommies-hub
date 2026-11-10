-- Daily card: you can't pick yourself. card_today also returns 'me' so the UI can disable your own tile.
create or replace function public.pick_card(p_pick uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; d date; reward int;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  if not exists (select 1 from public.household_members where household_id = hid and user_id = p_pick) then
    raise exception 'unknown roommate';
  end if;
  if p_pick = me then raise exception 'you can''t pick yourself'; end if;
  d := public.household_today(hid);
  insert into public.card_picks (household_id, local_date, voter_id, pick_id) values (hid, d, me, p_pick)
  on conflict (household_id, local_date, voter_id) do update set pick_id = excluded.pick_id, picked_at = now();
  select card_reward into reward from public.households where id = hid;
  if reward > 0 then
    perform public.ensure_wallet(me, hid);
    perform public.post_ledger(me, hid, reward, 'game', 'card:' || hid || ':' || d || ':' || me);
  end if;
end $$;

create or replace function public.card_today() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; d date; mine uuid; voted boolean; cd public.card_days;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  perform public.settle_cards(hid);
  d := public.household_today(hid);
  perform public.card_ensure_day(hid, d);
  select * into cd from public.card_days where household_id = hid and local_date = d;
  select pick_id into mine from public.card_picks where household_id = hid and local_date = d and voter_id = me;
  voted := mine is not null;
  return jsonb_build_object(
    'date', d,
    'prompt', cd.prompt,
    'suggested_by', (select display_name from public.profiles where id = cd.suggested_by),
    'voted', voted,
    'my_pick', mine,
    'me', me,
    'members', (select count(*) from public.household_members where household_id = hid),
    'voted_count', (select count(*) from public.card_picks where household_id = hid and local_date = d),
    'options', (
      select jsonb_agg(jsonb_build_object(
        'id', m.user_id, 'name', p.display_name,
        'votes', case when voted then (select count(*) from public.card_picks k where k.household_id = hid and k.local_date = d and k.pick_id = m.user_id) end)
        order by p.display_name)
      from public.household_members m join public.profiles p on p.id = m.user_id
      where m.household_id = hid));
end $$;
