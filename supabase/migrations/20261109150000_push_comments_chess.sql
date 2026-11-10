-- Push for comments (photos, plans, feature ideas) and for opening a chess game; "comments" becomes a mutable category.

create or replace function public.set_notification_prefs(p_muted text[], p_quiet_start time, p_quiet_end time) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from unnest(p_muted) x where x <> all (array['chat','dm','comments','plans','photos','rally','markets','games','thursday','birthdays','pets','chess','other'])) then
    raise exception 'unknown category';
  end if;
  if (p_quiet_start is null) <> (p_quiet_end is null) then raise exception 'set both quiet hours or neither'; end if;
  insert into public.notification_prefs (user_id, muted, quiet_start, quiet_end) values (me, coalesce(p_muted, '{}'), p_quiet_start, p_quiet_end)
  on conflict (user_id) do update set muted = excluded.muted, quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end, updated_at = now();
end $$;

create or replace function public.push_allowed(p_user uuid, p_category text) returns boolean
language sql stable security definer set search_path = '' as $$
  with cat as (
    select case when p_category = any (array['chat','dm','comments','plans','photos','rally','markets','games','thursday','birthdays','pets','chess']) then p_category else 'other' end as c
  ), pref as (select * from public.notification_prefs where user_id = p_user), loc as (
    select (now() at time zone h.timezone)::time as t from public.household_members m join public.households h on h.id = m.household_id where m.user_id = p_user
  )
  select not coalesce((select (select c from cat) = any (muted) from pref), false)
     and not coalesce((select case when pref.quiet_start <= pref.quiet_end
                                   then loc.t between pref.quiet_start and pref.quiet_end
                                   else loc.t >= pref.quiet_start or loc.t < pref.quiet_end end
                       from pref, loc where pref.quiet_start is not null), false);
$$;

-- Called by the commenter's browser right after posting. Returns a push event id (or null: stale, not yours, or already announced).
create function public.notify_comment(p_kind text, p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); who text; hid uuid; author uuid; txt text; made timestamptz; url text; title text; n int; ptitle text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select display_name into who from public.profiles where id = me;
  if p_kind = 'post' then
    select c.household_id, c.user_id, c.body, c.created_at into hid, author, txt, made from public.post_comments c where c.id = p_id;
    url := '/daily'; title := who || ' commented on a photo';
  elsif p_kind = 'plan' then
    select c.household_id, c.user_id, c.body, c.created_at, '/plans/' || c.plan_id, p.title into hid, author, txt, made, url, ptitle
      from public.plan_comments c join public.plans p on p.id = c.plan_id where c.id = p_id;
    title := who || ' commented on ' || ptitle;
  elsif p_kind = 'feature' then
    select c.household_id, c.user_id, c.body, c.created_at, '/features/' || c.request_id into hid, author, txt, made, url from public.feature_comments c where c.id = p_id;
    title := who || ' commented on a feature idea';
  else
    raise exception 'unknown kind';
  end if;
  if hid is null or author <> me or made < now() - interval '2 minutes' then return null; end if;
  insert into public.push_log (ref) values ('comment:' || p_kind || ':' || p_id) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return null; end if;
  return public.emit_push_event(hid, me, 'comments', title, left(txt, 140), url, null);
end $$;
revoke all on function public.notify_comment from public, anon;
grant execute on function public.notify_comment to authenticated;

-- opening a chess game announces it to the house (moves and joins already notify)
create or replace function public.chess_create(p_buy_in int, p_color text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; g uuid; ev uuid;
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
  ev := public.emit_push_event(hid, me, 'chess', 'Chess game open', public.chess_name(me) || ' opened a chess game' ||
    case when p_buy_in > 0 then ' (' || p_buy_in || ' bingdon buy-in)' else '' end || '. Join?', '/games/chess/' || g, null);
  return jsonb_build_object('game', g, 'event', ev);
end $$;
