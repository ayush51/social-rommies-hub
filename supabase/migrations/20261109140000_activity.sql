-- "Around the house": a household-wide feed of recent happenings. Never includes DMs, bet amounts or bingdon balances.
create function public.activity_feed(p_limit int default 15) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('at', f.at, 'text', f.text, 'url', f.url) order by f.at desc) from (
      select u.at, u.text, u.url from (
        select d.created_at as at, p.display_name || ' posted today''s photo' as text, '/daily' as url
          from public.daily_posts d join public.profiles p on p.id = d.user_id where d.household_id = hid
        union all
        select pl.created_at, p.display_name || ' made a plan: ' || pl.title, '/plans/' || pl.id
          from public.plans pl join public.profiles p on p.id = pl.created_by where pl.household_id = hid
        union all
        select m.created_at, p.display_name || ' started a prediction: ' || m.question, '/predictions/' || m.id
          from public.markets m join public.profiles p on p.id = m.created_by where m.household_id = hid
        union all
        select m.resolved_at, 'Prediction settled: ' || m.question, '/predictions/' || m.id
          from public.markets m where m.household_id = hid and m.status = 'resolved' and m.resolved_at is not null
        union all
        select r.created_at, p.display_name || ' rallied the house: ' || r.label, '/'
          from public.rallies r join public.profiles p on p.id = r.user_id where r.household_id = hid
        union all
        select cr.settled_at, 'Most likely yesterday: ' || (select string_agg(pp.display_name, ', ') from public.profiles pp where pp.id = any (cr.winner_ids)), '/games'
          from public.card_results cr where cr.household_id = hid and cardinality(cr.winner_ids) > 0
        union all
        select e.created_at, e.text, '/games/monopoly/' || e.game_id
          from public.monopoly_events e where e.household_id = hid and e.notify_mode = 'house'
        union all
        select fr.updated_at, 'Feature ' || fr.status || ': ' || fr.title, '/features/' || fr.id
          from public.feature_requests fr where fr.household_id = hid and fr.status in ('approved', 'building', 'shipped')
        union all
        select a.created_at, p.display_name || case a.kind when 'feed' then ' fed ' else ' gave a treat to ' end || pt.name, '/pets'
          from public.pet_actions a join public.pets pt on pt.id = a.pet_id join public.profiles p on p.id = a.user_id where a.household_id = hid
        union all
        select g.finished_at,
               case g.result when 'draw' then wp.display_name || ' and ' || bp.display_name || ' drew at chess'
                             when 'white' then wp.display_name || ' beat ' || bp.display_name || ' at chess'
                             else bp.display_name || ' beat ' || wp.display_name || ' at chess' end,
               '/games/chess/' || g.id
          from public.chess_games g join public.profiles wp on wp.id = g.white_id join public.profiles bp on bp.id = g.black_id
          where g.household_id = hid and g.status = 'finished' and g.finished_at is not null
        union all
        select sp.created_at, p.display_name || ' bought ' || si.name, '/wallet'
          from public.shop_purchases sp join public.shop_items si on si.code = sp.item_code join public.profiles p on p.id = sp.user_id
          where sp.household_id = hid and sp.item_code <> 'question_pass'
      ) u where u.at > now() - interval '7 days' order by u.at desc limit least(greatest(p_limit, 1), 50)
    ) f), '[]'::jsonb);
end $$;
revoke all on function public.activity_feed from public, anon;
grant execute on function public.activity_feed to authenticated;
