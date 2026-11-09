-- Admin dashboard: configurable rewards, household validation, roommate management, error log, stats.

alter table public.households
  add column card_reward int not null default 5 check (card_reward between 0 and 100),
  add column poll_reward int not null default 5 check (poll_reward between 0 and 100);

create function public.validate_household() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then raise exception 'unknown timezone'; end if;
  if new.daily_reset_time > time '12:00' then raise exception 'reset time must be between midnight and noon'; end if;
  return new;
end $$;
create trigger households_validate before insert or update of timezone, daily_reset_time on public.households
for each row execute function public.validate_household();

-- rewards now come from the household settings
create or replace function public.pick_card(p_pick uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; d date; reward int;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  if not exists (select 1 from public.household_members where household_id = hid and user_id = p_pick) then
    raise exception 'unknown roommate';
  end if;
  d := public.household_today(hid);
  insert into public.card_picks (household_id, local_date, voter_id, pick_id) values (hid, d, me, p_pick)
  on conflict (household_id, local_date, voter_id) do update set pick_id = excluded.pick_id, picked_at = now();
  select card_reward into reward from public.households where id = hid;
  if reward > 0 then
    perform public.ensure_wallet(me, hid);
    perform public.post_ledger(me, hid, reward, 'game', 'card:' || hid || ':' || d || ':' || me);
  end if;
end $$;

create or replace function public.do_vote(p_user uuid, p_dish uuid, p_now timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare hid uuid; w record; d public.dishes; reward int;
begin
  select household_id into hid from public.household_members where user_id = p_user;
  if hid is null then raise exception 'not in a household'; end if;
  select * into w from public.poll_window(hid, p_now);
  if w.phase <> 'open' then raise exception 'voting is closed'; end if;
  select * into d from public.dishes where id = p_dish;
  if not found or d.household_id <> hid or not d.active then raise exception 'unknown dish'; end if;

  insert into public.poll_votes (household_id, week_start, user_id, dish_id)
  values (hid, w.week_start, p_user, p_dish)
  on conflict (household_id, week_start, user_id) do update set dish_id = excluded.dish_id, voted_at = now();

  select poll_reward into reward from public.households where id = hid;
  if reward > 0 then
    perform public.ensure_wallet(p_user, hid);
    perform public.post_ledger(p_user, hid, reward, 'poll', 'poll:' || hid || ':' || w.week_start || ':' || p_user);
  end if;
end $$;

-- ---------- roommates ----------
create function private.code_ok(p text) returns boolean language sql immutable as $$
  select p ~ '^\d{6}$' and p !~ '^(\d)\1{5}$' and '0123456789' not like '%' || p || '%' and '9876543210' not like '%' || p || '%';
$$;

-- names on the login screen (names are already visible there; no emails or ids)
create function public.login_roster() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(p.display_name order by p.display_name), '[]'::jsonb)
  from public.profiles p join public.household_members m on m.user_id = p.id;
$$;
revoke all on function public.login_roster from public;
grant execute on function public.login_roster to anon, authenticated;

create function public.set_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  if p_role not in ('member', 'admin') then raise exception 'bad role'; end if;
  select household_id into hid from public.household_members where user_id = p_user;
  if hid is null or not public.is_household_admin(hid) then raise exception 'not allowed'; end if;
  if p_role = 'member' and (select count(*) from public.household_members where household_id = hid and role = 'admin' and user_id <> p_user) = 0 then
    raise exception 'there must be at least one admin';
  end if;
  update public.household_members set role = p_role where user_id = p_user;
end $$;

create function public.admin_add_roommate(p_name text, p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; uid uuid := gen_random_uuid(); mail text; nm text := btrim(p_name);
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null or not public.is_household_admin(hid) then raise exception 'not allowed'; end if;
  if nm !~ '^[A-Za-z][A-Za-z0-9]{0,19}$' then raise exception 'names are letters and numbers only, up to 20'; end if;
  if not private.code_ok(p_code) then raise exception 'the code must be 6 digits and not guessable'; end if;
  mail := lower(nm) || '@abingdon.example.com';
  if exists (select 1 from auth.users where email = mail) or exists (
    select 1 from public.profiles p join public.household_members m on m.user_id = p.id where m.household_id = hid and lower(p.display_name) = lower(nm)) then
    raise exception 'that name is taken';
  end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail, extensions.crypt(p_code, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true), 'email', now(), now(), now());
  update public.profiles set display_name = nm where id = uid;
  insert into public.household_members (household_id, user_id, role) values (hid, uid, 'member');
  return uid;
end $$;

create function public.admin_reset_code(p_user uuid, p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  select household_id into hid from public.household_members where user_id = p_user;
  if hid is null or not public.is_household_admin(hid) then raise exception 'not allowed'; end if;
  if not private.code_ok(p_code) then raise exception 'the code must be 6 digits and not guessable'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_code, extensions.gen_salt('bf')) where id = p_user;
  delete from auth.refresh_tokens where session_id in (select id from auth.sessions where user_id = p_user);
  delete from auth.sessions where user_id = p_user;
end $$;
revoke all on function public.set_member_role, public.admin_add_roommate, public.admin_reset_code from public, anon;
grant execute on function public.set_member_role, public.admin_add_roommate, public.admin_reset_code to authenticated;

-- ---------- error log ----------
create table public.app_errors (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  path text,
  message text not null,
  ua text,
  created_at timestamptz not null default now()
);
create index on public.app_errors (household_id, created_at desc);
alter table public.app_errors enable row level security;
create policy "admins read errors" on public.app_errors for select using (public.is_household_admin(household_id));
revoke insert, update, delete, truncate on public.app_errors from anon, authenticated;

create function public.log_error(p_path text, p_message text, p_ua text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then return; end if;
  if (select count(*) from public.app_errors where user_id = me and created_at > now() - interval '1 minute') >= 5 then return; end if;
  insert into public.app_errors (household_id, user_id, path, message, ua)
  values (hid, me, left(p_path, 200), left(coalesce(p_message, 'unknown'), 500), left(p_ua, 200));
end $$;
revoke all on function public.log_error from public, anon;
grant execute on function public.log_error to authenticated;

-- housekeeping: runs with the reminder dispatcher; keeps 30 days of errors
create function public.enqueue_errlog_reminders() returns int language plpgsql security definer set search_path = '' as $$
begin
  delete from public.app_errors where created_at < now() - interval '30 days';
  return 0;
end $$;
revoke all on function public.enqueue_errlog_reminders from public, anon, authenticated;

-- ---------- engagement (admin only; counts, never message content) ----------
create function public.admin_stats() returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null or not public.is_household_admin(hid) then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'messages_7d', (select count(*) from public.messages where household_id = hid and created_at > now() - interval '7 days'),
    'posts_7d', (select count(*) from public.daily_posts where household_id = hid and created_at > now() - interval '7 days'),
    'bets_7d', (select count(*) from public.market_bets where household_id = hid and created_at > now() - interval '7 days'),
    'plans_7d', (select count(*) from public.plans where household_id = hid and created_at > now() - interval '7 days'),
    'active_24h', (select count(*) from public.household_members m join public.profiles p on p.id = m.user_id where m.household_id = hid and p.last_seen_at > now() - interval '24 hours'),
    'errors_7d', (select count(*) from public.app_errors where household_id = hid and created_at > now() - interval '7 days'),
    'bingdons_in_circulation', (select coalesce(sum(balance), 0) from public.wallets where household_id = hid),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', p.display_name, 'role', m.role, 'last_seen_at', p.last_seen_at,
        'messages_7d', (select count(*) from public.messages x where x.user_id = m.user_id and x.created_at > now() - interval '7 days'),
        'posts_7d', (select count(*) from public.daily_posts x where x.user_id = m.user_id and x.created_at > now() - interval '7 days')) order by p.display_name), '[]'::jsonb)
      from public.household_members m join public.profiles p on p.id = m.user_id where m.household_id = hid));
end $$;
revoke all on function public.admin_stats from public, anon;
grant execute on function public.admin_stats to authenticated;
