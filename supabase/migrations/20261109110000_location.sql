-- Location sharing: opt-in, time-boxed, latest point only (no history). Expiry and pause are enforced here, not in the UI.
-- Clients can read through RLS but never write directly; every change goes through the security-definer functions below.

create table public.location_shares (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  precision text not null check (precision in ('approx', 'precise')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m int check (accuracy_m is null or accuracy_m >= 0),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paused boolean not null default false
);
create index on public.location_shares (household_id);
create index on public.location_shares (expires_at);

alter table public.location_shares enable row level security;
create policy "own share, or an active housemate share" on public.location_shares for select to authenticated using (
  user_id = auth.uid()
  or (public.is_household_member(household_id) and not paused and expires_at > now())
);
revoke insert, update, delete, truncate on public.location_shares from anon, authenticated;
revoke all on public.location_shares from anon;

-- Server-side precision: approx ~1 km (2 decimals), precise ~1 m (5 decimals).
create function public.location_round(p_v double precision, p_precision text) returns double precision
language sql immutable set search_path = '' as $$
  select round(p_v::numeric, case when p_precision = 'approx' then 2 else 5 end)::double precision;
$$;
revoke all on function public.location_round from public, anon, authenticated;

create function public.location_share(p_lat double precision, p_lng double precision, p_accuracy int, p_precision text, p_minutes int)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); hid uuid; exp timestamptz;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_precision is null or p_precision not in ('approx', 'precise') then raise exception 'bad precision'; end if;
  if p_minutes is null or p_minutes not in (15, 60, 240, 720, 1440) then raise exception 'bad duration'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'bad coordinates'; end if;
  select household_id into hid from public.household_members where user_id = uid limit 1;
  if hid is null then raise exception 'not in a household'; end if;
  exp := now() + make_interval(mins => p_minutes);
  insert into public.location_shares (user_id, household_id, precision, lat, lng, accuracy_m, updated_at, expires_at, paused)
  values (uid, hid, p_precision, public.location_round(p_lat, p_precision), public.location_round(p_lng, p_precision),
          case when p_accuracy is null then null when p_precision = 'approx' then greatest(p_accuracy, 1000) else greatest(p_accuracy, 0) end,
          now(), exp, false)
  on conflict (user_id) do update set household_id = excluded.household_id, precision = excluded.precision, lat = excluded.lat,
    lng = excluded.lng, accuracy_m = excluded.accuracy_m, updated_at = now(), expires_at = excluded.expires_at, paused = false;
  return exp;
end $$;

-- Moves the point only while sharing is active; never extends expiry. Returns false (quietly) if inactive or called too soon.
create function public.location_update(p_lat double precision, p_lng double precision, p_accuracy int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.location_shares;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'bad coordinates'; end if;
  select * into r from public.location_shares where user_id = uid for update;
  if not found or r.paused or r.expires_at <= now() then return false; end if;
  if r.updated_at > now() - interval '20 seconds' then return false; end if;
  update public.location_shares set
    lat = public.location_round(p_lat, r.precision), lng = public.location_round(p_lng, r.precision),
    accuracy_m = case when p_accuracy is null then null when r.precision = 'approx' then greatest(p_accuracy, 1000) else greatest(p_accuracy, 0) end,
    updated_at = now()
  where user_id = uid;
  return true;
end $$;

create function public.location_pause(p_paused boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_paused is null then raise exception 'bad value'; end if;
  update public.location_shares set paused = p_paused where user_id = auth.uid() and expires_at > now();
end $$;

create function public.location_stop() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.location_shares where user_id = auth.uid();
end $$;

revoke all on function public.location_share, public.location_update, public.location_pause, public.location_stop from public, anon;
grant execute on function public.location_share, public.location_update, public.location_pause, public.location_stop to authenticated;

-- Reminder dispatcher hook: only purges long-expired rows, never notifies.
create function public.enqueue_location_reminders() returns int
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.location_shares where expires_at < now() - interval '1 hour';
  return 0;
end $$;
revoke all on function public.enqueue_location_reminders from public, anon, authenticated;

alter publication supabase_realtime add table public.location_shares;
