-- Unread badges, editable chat messages, notification preferences (+ quiet hours), birthday reminders, drop invites.

-- ---------- unread chat ----------
create table public.chat_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread text not null,                       -- 'group' or a housemate's user id (DM)
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread)
);
alter table public.chat_reads enable row level security;
create policy "read own markers" on public.chat_reads for select using (user_id = auth.uid());
revoke insert, update, delete, truncate on public.chat_reads from anon, authenticated;

create function public.chat_unread() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; grp int; dms jsonb; total int;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  -- first sight of a thread starts it "read", so old history is not a pile of unread badges
  insert into public.chat_reads (user_id, thread, last_read_at) values (me, 'group', clock_timestamp()) on conflict do nothing;
  insert into public.chat_reads (user_id, thread, last_read_at)
    select me, m.user_id::text, clock_timestamp() from public.household_members m where m.household_id = hid and m.user_id <> me on conflict do nothing;
  select count(*) into grp from public.messages x
    where x.household_id = hid and x.recipient_id is null and x.user_id <> me
      and x.created_at > (select last_read_at from public.chat_reads where user_id = me and thread = 'group');
  select coalesce(jsonb_object_agg(s.thread, s.cnt), '{}'::jsonb), coalesce(sum(s.cnt), 0) into dms, total from (
    select r.thread, (select count(*) from public.messages x
                      where x.household_id = hid and x.recipient_id = me and x.user_id::text = r.thread and x.created_at > r.last_read_at) as cnt
    from public.chat_reads r where r.user_id = me and r.thread <> 'group') s where s.cnt > 0;
  return jsonb_build_object('group', grp, 'dms', dms, 'total', grp + total);
end $$;

create function public.mark_chat_read(p_thread text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  if p_thread <> 'group' and not exists (select 1 from public.household_members where household_id = hid and user_id::text = p_thread and user_id <> me) then
    raise exception 'unknown thread';
  end if;
  insert into public.chat_reads (user_id, thread, last_read_at) values (me, p_thread, clock_timestamp())
  on conflict (user_id, thread) do update set last_read_at = clock_timestamp();
end $$;
revoke all on function public.chat_unread, public.mark_chat_read from public, anon;
grant execute on function public.chat_unread, public.mark_chat_read to authenticated;

-- ---------- editable messages (body only, within an hour) ----------
alter table public.messages add column edited_at timestamptz;
revoke update on public.messages from anon, authenticated;
grant update (body) on public.messages to authenticated;
create policy "edit own message" on public.messages for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create function public.messages_edit_rules() returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body then
    if old.created_at < now() - interval '1 hour' then raise exception 'too old to edit'; end if;
    if char_length(new.body) = 0 and new.image_path is null then raise exception 'empty message'; end if;
    new.edited_at := now();
  end if;
  return new;
end $$;
create trigger messages_edit_rules before update on public.messages for each row execute function public.messages_edit_rules();

-- ---------- notification preferences ----------
create table public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  muted text[] not null default '{}',
  quiet_start time,
  quiet_end time,
  updated_at timestamptz not null default now(),
  check ((quiet_start is null) = (quiet_end is null))
);
alter table public.notification_prefs enable row level security;
create policy "read own prefs" on public.notification_prefs for select using (user_id = auth.uid());
revoke insert, update, delete, truncate on public.notification_prefs from anon, authenticated;

create function public.set_notification_prefs(p_muted text[], p_quiet_start time, p_quiet_end time) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from unnest(p_muted) x where x <> all (array['chat','dm','plans','photos','rally','markets','games','thursday','birthdays','pets','chess','other'])) then
    raise exception 'unknown category';
  end if;
  if (p_quiet_start is null) <> (p_quiet_end is null) then raise exception 'set both quiet hours or neither'; end if;
  insert into public.notification_prefs (user_id, muted, quiet_start, quiet_end) values (me, coalesce(p_muted, '{}'), p_quiet_start, p_quiet_end)
  on conflict (user_id) do update set muted = excluded.muted, quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end, updated_at = now();
end $$;
revoke all on function public.set_notification_prefs from public, anon;
grant execute on function public.set_notification_prefs to authenticated;

-- Would this user be pinged for this category right now? (muted category, or inside their quiet hours in the household timezone)
create function public.push_allowed(p_user uuid, p_category text) returns boolean
language sql stable security definer set search_path = '' as $$
  with cat as (
    select case when p_category = any (array['chat','dm','plans','photos','rally','markets','games','thursday','birthdays','pets','chess']) then p_category else 'other' end as c
  ), pref as (select * from public.notification_prefs where user_id = p_user), loc as (
    select (now() at time zone h.timezone)::time as t from public.household_members m join public.households h on h.id = m.household_id where m.user_id = p_user
  )
  select not coalesce((select (select c from cat) = any (muted) from pref), false)
     and not coalesce((select case when pref.quiet_start <= pref.quiet_end
                                   then loc.t between pref.quiet_start and pref.quiet_end
                                   else loc.t >= pref.quiet_start or loc.t < pref.quiet_end end
                       from pref, loc where pref.quiet_start is not null), false);
$$;
revoke all on function public.push_allowed from public, anon, authenticated;

create function public.reminder_category(p_kind text) returns text language sql immutable as $$
  select case
    when p_kind = 'plan_soon' then 'plans'
    when p_kind in ('poll_closing', 'poll_winner', 'poll_day') then 'thursday'
    when p_kind = 'market_due' then 'markets'
    when p_kind = 'birthday' then 'birthdays'
    when p_kind like 'pet%' then 'pets'
    else 'other' end;
$$;

-- push_targets: same as before plus a category per branch and the preference filter
create or replace function public.push_targets(p_kind text, p_ref uuid)
returns table (endpoint text, p256dh text, auth text, title text, body text, url text)
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; who text; t text; b text; u text; n int; nu uuid; cat text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select display_name into who from public.profiles where id = me;

  if p_kind = 'message' then
    select m.household_id, who, left(coalesce(nullif(m.body, ''), 'Sent a photo'), 140),
           case when m.recipient_id is null then '/chat' else '/chat/dm/' || me end, m.recipient_id,
           case when m.recipient_id is null then 'chat' else 'dm' end
      into hid, t, b, u, nu, cat
    from public.messages m where m.id = p_ref and m.user_id = me and m.created_at > now() - interval '2 minutes';
  elsif p_kind = 'plan' then
    select p.household_id, 'New plan', who || ': ' || p.title, '/plans/' || p.id, 'plans' into hid, t, b, u, cat
    from public.plans p where p.id = p_ref and p.created_by = me and p.created_at > now() - interval '2 minutes';
  elsif p_kind = 'post' then
    select d.household_id, who || ' posted today''s photo', coalesce(d.caption, 'Take a look'), '/daily', 'photos' into hid, t, b, u, cat
    from public.daily_posts d where d.id = p_ref and d.user_id = me and d.created_at > now() - interval '2 minutes';
  elsif p_kind = 'rally' then
    select r.household_id, who || ' is rallying the house', r.label || '. Who''s in?', '/', 'rally' into hid, t, b, u, cat
    from public.rallies r where r.id = p_ref and r.user_id = me and r.created_at > now() - interval '2 minutes';
  elsif p_kind = 'market' then
    select k.household_id, who || ' started a prediction', k.question, '/predictions/' || k.id, 'markets' into hid, t, b, u, cat
    from public.markets k where k.id = p_ref and k.created_by = me and k.created_at > now() - interval '2 minutes';
  elsif p_kind = 'game' then
    select e.household_id, 'Abingdon Street', e.text, '/games/monopoly/' || e.game_id,
           case when e.notify_mode = 'user' then e.notify_user end, 'games'
      into hid, t, b, u, nu, cat
    from public.monopoly_events e
    where e.id = p_ref and e.actor = me and e.notify_mode <> 'none' and e.created_at > now() - interval '2 minutes';
  elsif p_kind = 'event' then
    select e.household_id, e.title, e.body, e.url, e.notify_user, e.category into hid, t, b, u, nu, cat
    from public.push_events e where e.id = p_ref and e.actor = me and e.created_at > now() - interval '2 minutes';
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
    where s.household_id = hid and s.user_id <> me and (nu is null or s.user_id = nu) and public.push_allowed(s.user_id, cat);
end $$;

-- reminders honour the same preferences
create or replace function public.reminders_claim(p_secret text)
returns table (endpoint text, p256dh text, auth text, title text, body text, url text)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.cron_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  update public.reminder_outbox set sent_at = now() where sent_at is null and created_at < now() - interval '3 hours';
  return query
    with claimed as (
      update public.reminder_outbox o set sent_at = now() where o.sent_at is null returning o.kind, o.title, o.body, o.url, o.recipients)
    select s.endpoint, s.p256dh, s.auth, c.title, c.body, c.url
    from claimed c join public.push_subscriptions s on s.user_id = any(c.recipients)
    where public.push_allowed(s.user_id, public.reminder_category(c.kind));
end $$;

-- ---------- birthdays (picked up by the reminder dispatcher) ----------
create function public.birthday_reminders_at(p_now timestamptz) returns int
language plpgsql security definer set search_path = '' as $$
declare c int;
begin
  insert into public.reminder_outbox (kind, ref, household_id, title, body, url, recipients)
  select 'birthday', p.id || ':' || extract(year from (p_now at time zone h.timezone))::int, m.household_id, 'Birthday today',
         p.display_name || ' has a birthday today', '/',
         array(select x.user_id from public.household_members x where x.household_id = m.household_id and x.user_id <> p.id)
  from public.profiles p
  join public.household_members m on m.user_id = p.id
  join public.households h on h.id = m.household_id
  where p.dob is not null
    and to_char(p.dob, 'MM-DD') = to_char(p_now at time zone h.timezone, 'MM-DD')
    and (p_now at time zone h.timezone)::time >= time '09:00'
  on conflict (kind, ref) do nothing;
  get diagnostics c = row_count;
  return c;
end $$;
create function public.enqueue_birthdays_reminders() returns int
language sql security definer set search_path = '' as $$ select public.birthday_reminders_at(now()); $$;
revoke all on function public.birthday_reminders_at, public.enqueue_birthdays_reminders, public.reminder_category from public, anon, authenticated;

-- ---------- invites are gone (the six roommates are provisioned by an admin) ----------
drop function public.create_invite(uuid, int);
drop function public.redeem_invite(text);
drop function public.create_household(text, text);
drop table public.invites;

