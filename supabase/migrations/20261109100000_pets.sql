-- Pets: admins manage them, everyone feeds and loves them. Hunger and happiness decay lazily on read.

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  species text not null default 'pet' check (char_length(species) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 300),
  photo_path text,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.pets (household_id, created_at);

create table public.pet_state (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  hunger int not null default 30 check (hunger between 0 and 100),
  happiness int not null default 70 check (happiness between 0 and 100),
  updated_at timestamptz not null default now()
);

create table public.pet_actions (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('feed', 'treat')),
  local_date date not null,
  created_at timestamptz not null default now()
);
create index on public.pet_actions (pet_id, created_at desc);
create index on public.pet_actions (pet_id, user_id, local_date);
create index on public.pet_actions (household_id);

alter table public.pets enable row level security;
alter table public.pet_state enable row level security;
alter table public.pet_actions enable row level security;
create policy "members read pets" on public.pets for select using (public.is_household_member(household_id));
create policy "members read pet state" on public.pet_state for select using (public.is_household_member(household_id));
create policy "members read pet actions" on public.pet_actions for select using (public.is_household_member(household_id));
revoke insert, update, delete, truncate on public.pets, public.pet_state, public.pet_actions from anon, authenticated;

alter publication supabase_realtime add table public.pets, public.pet_actions;

-- ---------- decay (internal) ----------
create function public.pets_state_at(p_pet uuid, p_at timestamptz default now()) returns table (hunger int, happiness int)
language sql stable security definer set search_path = '' as $$
  select least(100, s.hunger + floor(3 * greatest(0, extract(epoch from p_at - s.updated_at)) / 3600))::int,
         greatest(0, s.happiness - floor(2 * greatest(0, extract(epoch from p_at - s.updated_at)) / 3600))::int
  from public.pet_state s where s.pet_id = p_pet;
$$;
revoke all on function public.pets_state_at from public, anon, authenticated;

-- ---------- admin ----------
create function public.pets_create(p_name text, p_species text, p_bio text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; pid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select household_id into hid from public.household_members where user_id = me and role = 'admin';
  if hid is null then raise exception 'admin only'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 40 then raise exception 'invalid name'; end if;
  if char_length(btrim(coalesce(p_species, ''))) not between 1 and 40 then raise exception 'invalid species'; end if;
  if char_length(coalesce(p_bio, '')) > 300 then raise exception 'bio too long'; end if;
  if (select count(*) from public.pets where household_id = hid) >= 20 then raise exception 'too many pets'; end if;
  insert into public.pets (household_id, name, species, bio, created_by)
  values (hid, btrim(p_name), btrim(p_species), coalesce(p_bio, ''), me) returning id into pid;
  insert into public.pet_state (pet_id, household_id) values (pid, hid);
  return pid;
end $$;

-- p_photo_path: null keeps the current photo, '' clears it
create function public.pets_update(p_pet uuid, p_name text, p_species text, p_bio text, p_photo_path text, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare pet public.pets;
begin
  select * into pet from public.pets where id = p_pet;
  if not found or not public.is_household_admin(pet.household_id) then raise exception 'admin only'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 40 then raise exception 'invalid name'; end if;
  if char_length(btrim(coalesce(p_species, ''))) not between 1 and 40 then raise exception 'invalid species'; end if;
  if char_length(coalesce(p_bio, '')) > 300 then raise exception 'bio too long'; end if;
  if p_photo_path is not null and p_photo_path <> '' and p_photo_path not like pet.household_id || '/' || pet.id || '/%' then
    raise exception 'invalid photo path';
  end if;
  update public.pets set name = btrim(p_name), species = btrim(p_species), bio = coalesce(p_bio, ''),
    photo_path = case when p_photo_path is null then photo_path else nullif(p_photo_path, '') end,
    active = coalesce(p_active, active)
  where id = p_pet;
end $$;

-- ---------- feed / treat ----------
create function public.pets_status(p_pet uuid, p_user uuid, p_extra jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pet public.pets; today date; st record; f int; t int;
begin
  select * into pet from public.pets where id = p_pet;
  today := public.household_today(pet.household_id);
  select * into st from public.pets_state_at(p_pet);
  select count(*) filter (where kind = 'feed'), count(*) filter (where kind = 'treat') into f, t
  from public.pet_actions where pet_id = p_pet and user_id = p_user and local_date = today;
  return jsonb_build_object('hunger', st.hunger, 'happiness', st.happiness, 'feeds_left', greatest(0, 2 - f), 'treats_left', greatest(0, 3 - t)) || p_extra;
end $$;
revoke all on function public.pets_status from public, anon, authenticated;

create function public.pets_feed(p_pet uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); pet public.pets; today date; st record; n int; reward int := 0;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into pet from public.pets where id = p_pet;
  if not found or not pet.active or not public.is_household_member(pet.household_id) then raise exception 'not found'; end if;
  perform 1 from public.pet_state where pet_id = p_pet for update;
  today := public.household_today(pet.household_id);
  select count(*) into n from public.pet_actions where pet_id = p_pet and user_id = me and kind = 'feed' and local_date = today;
  if n >= 2 then raise exception 'feed limit reached'; end if;
  select * into st from public.pets_state_at(p_pet);
  if st.hunger >= 50 then
    perform public.ensure_wallet(me, pet.household_id);
    if public.post_ledger(me, pet.household_id, 2, 'pet_reward', 'pet_reward:' || p_pet || ':' || me || ':' || today, p_pet::text) then
      reward := 2;
    end if;
  end if;
  insert into public.pet_actions (pet_id, user_id, household_id, kind, local_date) values (p_pet, me, pet.household_id, 'feed', today);
  update public.pet_state set hunger = greatest(0, st.hunger - 40), happiness = st.happiness, updated_at = now() where pet_id = p_pet;
  return public.pets_status(p_pet, me, jsonb_build_object('reward', reward));
end $$;

-- p_key is a client-generated uuid per tap, so a retried request cannot double-charge.
create function public.pets_treat(p_pet uuid, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); pet public.pets; today date; st record; n int; bal bigint; k text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_key is null then raise exception 'missing key'; end if;
  select * into pet from public.pets where id = p_pet;
  if not found or not pet.active or not public.is_household_member(pet.household_id) then raise exception 'not found'; end if;
  k := 'pet_treat:' || me || ':' || p_key;
  perform 1 from public.pet_state where pet_id = p_pet for update;
  if exists (select 1 from public.ledger_entries where idempotency_key = k) then
    return public.pets_status(p_pet, me, jsonb_build_object('replay', true));
  end if;
  today := public.household_today(pet.household_id);
  select count(*) into n from public.pet_actions where pet_id = p_pet and user_id = me and kind = 'treat' and local_date = today;
  if n >= 3 then raise exception 'treat limit reached'; end if;
  perform public.ensure_wallet(me, pet.household_id);
  perform 1 from public.wallets where user_id = me for update;
  select balance into bal from public.wallets where user_id = me;
  if bal < 3 then raise exception 'insufficient bingdons'; end if;
  perform public.post_ledger(me, pet.household_id, -3, 'pet_treat', k, p_pet::text);
  select * into st from public.pets_state_at(p_pet);
  insert into public.pet_actions (pet_id, user_id, household_id, kind, local_date) values (p_pet, me, pet.household_id, 'treat', today);
  update public.pet_state set hunger = st.hunger, happiness = least(100, st.happiness + 15), updated_at = now() where pet_id = p_pet;
  return public.pets_status(p_pet, me, jsonb_build_object('replay', false));
end $$;

-- ---------- reads ----------
-- Pets with current (decayed) state, who fed last, and my remaining feeds/treats today.
create function public.pets_overview(p_pet uuid default null, p_all boolean default false) returns table (
  id uuid, name text, species text, bio text, photo_path text, active boolean,
  hunger int, happiness int, last_fed_by text, last_fed_at timestamptz, feeds_left int, treats_left int)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; adm boolean; today date;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select m.household_id, m.role = 'admin' into hid, adm from public.household_members m where m.user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  today := public.household_today(hid);
  return query
  select p.id, p.name, p.species, p.bio, p.photo_path, p.active, d.hunger, d.happiness,
         lf.display_name, lf.created_at,
         greatest(0, 2 - (select count(*) from public.pet_actions a where a.pet_id = p.id and a.user_id = me and a.kind = 'feed' and a.local_date = today))::int,
         greatest(0, 3 - (select count(*) from public.pet_actions a where a.pet_id = p.id and a.user_id = me and a.kind = 'treat' and a.local_date = today))::int
  from public.pets p
  cross join lateral public.pets_state_at(p.id) d
  left join lateral (
    select pr.display_name, a.created_at from public.pet_actions a join public.profiles pr on pr.id = a.user_id
    where a.pet_id = p.id and a.kind = 'feed' order by a.created_at desc limit 1) lf on true
  where p.household_id = hid and (p_pet is null or p.id = p_pet) and (p.active or (p_all and adm))
  order by p.created_at;
end $$;

create function public.pets_recent(p_pet uuid, p_limit int default 20) returns table (kind text, user_id uuid, display_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare hid uuid;
begin
  select p.household_id into hid from public.pets p where p.id = p_pet;
  if hid is null or not public.is_household_member(hid) then raise exception 'not found'; end if;
  return query
  select a.kind, a.user_id, pr.display_name, a.created_at from public.pet_actions a join public.profiles pr on pr.id = a.user_id
  where a.pet_id = p_pet order by a.created_at desc limit least(greatest(p_limit, 1), 50);
end $$;

-- ---------- reminders ----------
create function public.pets_enqueue_reminders_at(p_now timestamptz) returns int
language plpgsql security definer set search_path = '' as $$
declare c int;
begin
  insert into public.reminder_outbox (kind, ref, household_id, title, body, url, recipients)
  select 'pet_hungry', p.id || ':' || floor(extract(epoch from p_now) / 43200)::bigint, p.household_id,
         p.name || ' is hungry', 'Someone feed ' || p.name || '.', '/pets',
         (select array_agg(m.user_id) from public.household_members m where m.household_id = p.household_id)
  from public.pets p cross join lateral public.pets_state_at(p.id, p_now) d
  where p.active and d.hunger >= 80
  on conflict (kind, ref) do nothing;
  get diagnostics c = row_count;
  return c;
end $$;
create function public.enqueue_pets_reminders() returns int
language sql security definer set search_path = '' as $$
  select public.pets_enqueue_reminders_at(now());
$$;
revoke all on function public.pets_enqueue_reminders_at, public.enqueue_pets_reminders from public, anon, authenticated;

-- ---------- client-callable grants ----------
revoke all on function public.pets_create, public.pets_update, public.pets_feed, public.pets_treat, public.pets_overview, public.pets_recent from public, anon;
grant execute on function public.pets_create, public.pets_update, public.pets_feed, public.pets_treat, public.pets_overview, public.pets_recent to authenticated;

-- ---------- photos: private bucket, members read, admins write ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pets', 'pets', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "pets: members read" on storage.objects for select to authenticated using (
  bucket_id = 'pets' and exists (
    select 1 from public.household_members m where m.user_id = auth.uid() and m.household_id::text = (storage.foldername(name))[1]));
create policy "pets: admins upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'pets' and exists (
    select 1 from public.household_members m where m.user_id = auth.uid() and m.role = 'admin' and m.household_id::text = (storage.foldername(name))[1]));
create policy "pets: admins delete" on storage.objects for delete to authenticated using (
  bucket_id = 'pets' and exists (
    select 1 from public.household_members m where m.user_id = auth.uid() and m.role = 'admin' and m.household_id::text = (storage.foldername(name))[1]));
