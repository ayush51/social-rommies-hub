-- Phase 1: households, profiles, membership, invites.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  timezone text not null default 'UTC',
  daily_reset_time time not null default '00:00',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  nickname text check (char_length(nickname) <= 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default now() + interval '7 days',
  max_uses int not null default 1 check (max_uses > 0),
  uses int not null default 0,
  created_at timestamptz not null default now()
);

-- Profile row is created automatically on signup.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Roomie'));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS helpers (security definer so policies on household_members don't recurse).
create function public.is_household_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create function public.is_household_admin(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid() and role = 'admin'
  );
$$;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_members enable row level security;
alter table public.invites enable row level security;

create policy "members read household" on public.households
  for select using (public.is_household_member(id));
create policy "admins update household" on public.households
  for update using (public.is_household_admin(id)) with check (public.is_household_admin(id));

create policy "read own or housemate profiles" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.household_members a
      join public.household_members b on a.household_id = b.household_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "members read membership" on public.household_members
  for select using (public.is_household_member(household_id));

create policy "admins read invites" on public.invites
  for select using (public.is_household_admin(household_id));

-- No insert/update/delete policies on members or invites: writes go through RPCs below.

-- Bootstrap: an authenticated user without a household creates one and becomes admin.
create function public.create_household(p_name text, p_timezone text default 'UTC')
returns uuid language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'already in a household';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'invalid timezone';
  end if;
  insert into public.households (name, timezone) values (p_name, p_timezone) returning id into hid;
  insert into public.household_members (household_id, user_id, role) values (hid, auth.uid(), 'admin');
  return hid;
end $$;

create function public.create_invite(p_household uuid, p_max_uses int default 1)
returns text language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not public.is_household_admin(p_household) then raise exception 'forbidden'; end if;
  c := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
  insert into public.invites (household_id, code, created_by, max_uses)
  values (p_household, c, auth.uid(), p_max_uses);
  return c;
end $$;

-- Atomic redemption: row lock prevents exceeding max_uses under concurrency.
create function public.redeem_invite(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'already in a household';
  end if;
  select * into inv from public.invites where code = upper(trim(p_code)) for update;
  if not found or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'invalid or expired invite';
  end if;
  update public.invites set uses = uses + 1 where id = inv.id;
  insert into public.household_members (household_id, user_id) values (inv.household_id, auth.uid());
  return inv.household_id;
end $$;

revoke all on function public.create_household, public.create_invite, public.redeem_invite from public, anon;
grant execute on function public.create_household, public.create_invite, public.redeem_invite to authenticated;
revoke all on function public.is_household_member, public.is_household_admin from public, anon;
grant execute on function public.is_household_member, public.is_household_admin to authenticated;
