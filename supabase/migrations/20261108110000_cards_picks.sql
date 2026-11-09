-- Daily card v2: "who's most likely to ..." — pick a roommate instead of typing an answer.
-- (v1 tables held no data.)

drop function if exists public.card_today, public.submit_card_answer, public.vote_card, public.card_history, public.settle_cards;
drop table if exists public.card_votes, public.card_answers;

create table public.card_picks (
  household_id uuid not null references public.households(id) on delete cascade,
  local_date date not null,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  pick_id uuid not null references public.profiles(id) on delete cascade,
  picked_at timestamptz not null default now(),
  primary key (household_id, local_date, voter_id)
);
create index on public.card_picks (household_id, local_date, pick_id);
alter table public.card_picks enable row level security;
revoke all on public.card_picks from anon, authenticated;

-- winner_ids now means "crowned" (most votes); ties share the crown.
delete from public.card_results;
delete from public.card_prompts;
insert into public.card_prompts (text) values
  ('Who''s most likely to eat someone else''s leftovers and deny it?'),
  ('Who''s most likely to sleep through their own alarm and the fire alarm?'),
  ('Who''s most likely to start a business that fails spectacularly?'),
  ('Who''s most likely to cry during a movie trailer?'),
  ('Who''s most likely to get us banned from a restaurant?'),
  ('Who''s most likely to leave a pan "soaking" for three days?'),
  ('Who''s most likely to become famous for something embarrassing?'),
  ('Who''s most likely to talk their way out of a parking ticket?'),
  ('Who''s most likely to adopt a pet without telling anyone?'),
  ('Who''s most likely to win the lottery and lose the ticket?'),
  ('Who''s most likely to survive a zombie apocalypse?'),
  ('Who''s most likely to get lost while following GPS?'),
  ('Who''s most likely to set off the smoke alarm while cooking?'),
  ('Who''s most likely to say "one more episode" and watch five?'),
  ('Who''s most likely to text back three days later?'),
  ('Who''s most likely to talk to a stranger for an hour?'),
  ('Who''s most likely to be late to their own birthday party?'),
  ('Who''s most likely to rearrange the furniture at 2 a.m.?'),
  ('Who''s most likely to fall asleep in a weird place?'),
  ('Who''s most likely to quit their job dramatically?'),
  ('Who''s most likely to befriend the neighbors'' dog?'),
  ('Who''s most likely to forget why they walked into a room?'),
  ('Who''s most likely to cry at a wedding?'),
  ('Who''s most likely to order dessert first?'),
  ('Who''s most likely to get a tattoo on a whim?'),
  ('Who''s most likely to win an argument they started by accident?'),
  ('Who''s most likely to wear pajamas to a fancy dinner?'),
  ('Who''s most likely to buy something online they absolutely don''t need?'),
  ('Who''s most likely to start a group chat and then mute it?'),
  ('Who''s most likely to make a new best friend on a plane?'),
  ('Who''s most likely to lose their keys, phone and wallet in one day?'),
  ('Who''s most likely to turn a small plan into a whole production?'),
  ('Who''s most likely to bring a guest nobody knew about?'),
  ('Who''s most likely to fall asleep at a party?'),
  ('Who''s most likely to get really into a new hobby for exactly one week?'),
  ('Who''s most likely to dance on a table?'),
  ('Who''s most likely to say "five minutes away" while still in bed?'),
  ('Who''s most likely to take the best photo of the group and ruin it?'),
  ('Who''s most likely to become the mayor of Abingdon Street?'),
  ('Who''s most likely to talk during a movie?');

-- Crowns finished days exactly once (results row is the guard).
create function public.settle_cards(p_hid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; maxv int; winners uuid[];
begin
  for r in
    select distinct p.local_date as d from public.card_picks p
    where p.household_id = p_hid and p.local_date < public.household_today(p_hid)
      and not exists (select 1 from public.card_results cr where cr.household_id = p_hid and cr.local_date = p.local_date)
  loop
    select max(c) into maxv from (
      select count(*) as c from public.card_picks where household_id = p_hid and local_date = r.d group by pick_id) t;
    winners := array(
      select pick_id from public.card_picks where household_id = p_hid and local_date = r.d
      group by pick_id having count(*) = maxv);
    insert into public.card_results (household_id, local_date, winner_ids) values (p_hid, r.d, winners)
    on conflict do nothing;
  end loop;
end $$;

-- Counts are hidden until you have voted yourself.
create function public.card_today() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; d date; mine uuid; voted boolean;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  perform public.settle_cards(hid);
  d := public.household_today(hid);
  select pick_id into mine from public.card_picks where household_id = hid and local_date = d and voter_id = me;
  voted := mine is not null;
  return jsonb_build_object(
    'date', d,
    'prompt', public.card_prompt_for(hid, d),
    'voted', voted,
    'my_pick', mine,
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

create function public.pick_card(p_pick uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; d date;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  if not exists (select 1 from public.household_members where household_id = hid and user_id = p_pick) then
    raise exception 'unknown roommate';
  end if;
  d := public.household_today(hid);
  insert into public.card_picks (household_id, local_date, voter_id, pick_id) values (hid, d, me, p_pick)
  on conflict (household_id, local_date, voter_id) do update set pick_id = excluded.pick_id, picked_at = now();
  -- one participation reward per person per day, however often they change their pick
  perform public.ensure_wallet(me, hid);
  perform public.post_ledger(me, hid, 5, 'game', 'card:' || hid || ':' || d || ':' || me);
end $$;

create function public.card_history(p_limit int default 7) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  perform public.settle_cards(hid);
  return jsonb_build_object(
    'rounds', coalesce((
      select jsonb_agg(rd order by (rd->>'date') desc) from (
        select jsonb_build_object(
          'date', cr.local_date,
          'prompt', public.card_prompt_for(hid, cr.local_date),
          'winners', coalesce((select jsonb_agg(p.display_name) from public.profiles p where p.id = any(cr.winner_ids)), '[]'::jsonb),
          'results', coalesce((
            select jsonb_agg(jsonb_build_object('name', p.display_name, 'votes', t.c) order by t.c desc, p.display_name)
            from (select pick_id, count(*) c from public.card_picks k
                  where k.household_id = hid and k.local_date = cr.local_date group by pick_id) t
            join public.profiles p on p.id = t.pick_id), '[]'::jsonb)) as rd
        from public.card_results cr where cr.household_id = hid
        order by cr.local_date desc limit least(greatest(p_limit, 1), 30)) q), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.display_name, 'wins', s.wins) order by s.wins desc, p.display_name)
      from (select u as uid, count(*) as wins from public.card_results cr, unnest(cr.winner_ids) u
            where cr.household_id = hid group by u) s
      join public.profiles p on p.id = s.uid), '[]'::jsonb));
end $$;

revoke all on function public.settle_cards from public, anon, authenticated;
revoke all on function public.card_today, public.pick_card, public.card_history from public, anon;
grant execute on function public.card_today, public.pick_card, public.card_history to authenticated;
