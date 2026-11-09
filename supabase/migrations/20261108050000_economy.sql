-- Phase 3: Abby Coins. Virtual only: no deposit, withdrawal or cash value anywhere.

alter table public.households
  add column starting_balance int not null default 500 check (starting_balance >= 0),
  add column daily_reward int not null default 50 check (daily_reward >= 0);

create table public.wallets (
  user_id uuid primary key references public.profiles(id),
  household_id uuid not null references public.households(id),
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create index on public.wallets (household_id);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id),
  user_id uuid not null references public.profiles(id),
  amount bigint not null check (amount <> 0),
  kind text not null check (kind in ('starting', 'daily', 'tip_out', 'tip_in')),
  ref text,
  counterparty uuid references public.profiles(id),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index on public.ledger_entries (user_id, id desc);

create function public.ledger_immutable() returns trigger
language plpgsql as $$
begin raise exception 'ledger is append-only'; end $$;
create trigger ledger_append_only before update or delete on public.ledger_entries
for each row execute function public.ledger_immutable();

alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
create policy "members read wallets" on public.wallets
  for select using (public.is_household_member(household_id));
create policy "read own ledger" on public.ledger_entries
  for select using (user_id = auth.uid());
revoke insert, update, delete, truncate on public.wallets, public.ledger_entries from anon, authenticated;

-- Internal: the only writer of coins. Replays (same key) are no-ops.
create function public.post_ledger(
  p_user uuid, p_hid uuid, p_amount bigint, p_kind text, p_key text,
  p_ref text default null, p_counter uuid default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.wallets (user_id, household_id) values (p_user, p_hid) on conflict do nothing;
  perform 1 from public.wallets where user_id = p_user for update;
  insert into public.ledger_entries (household_id, user_id, amount, kind, ref, counterparty, idempotency_key)
  values (p_hid, p_user, p_amount, p_kind, p_ref, p_counter, p_key)
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  update public.wallets set balance = balance + p_amount, updated_at = now() where user_id = p_user;
  return true;
end $$;

create function public.ensure_wallet(p_user uuid, p_hid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s int;
begin
  select starting_balance into s from public.households where id = p_hid;
  if s > 0 then
    perform public.post_ledger(p_user, p_hid, s, 'starting', 'start:' || p_user);
  else
    insert into public.wallets (user_id, household_id) values (p_user, p_hid) on conflict do nothing;
  end if;
end $$;

create function public.my_wallet() returns bigint
language plpgsql security definer set search_path = '' as $$
declare hid uuid; bal bigint;
begin
  select household_id into hid from public.household_members where user_id = auth.uid();
  if hid is null then raise exception 'not in a household'; end if;
  perform public.ensure_wallet(auth.uid(), hid);
  select balance into bal from public.wallets where user_id = auth.uid();
  return bal;
end $$;

-- Returns coins granted (0 if already claimed for the household-local day).
create function public.claim_daily_reward() returns int
language plpgsql security definer set search_path = '' as $$
declare hid uuid; reward int;
begin
  select household_id into hid from public.household_members where user_id = auth.uid();
  if hid is null then raise exception 'not in a household'; end if;
  select daily_reward into reward from public.households where id = hid;
  perform public.ensure_wallet(auth.uid(), hid);
  if reward > 0 and public.post_ledger(auth.uid(), hid, reward, 'daily',
       'daily:' || auth.uid() || ':' || public.household_today(hid)) then
    return reward;
  end if;
  return 0;
end $$;

-- p_key is a client-generated uuid per tap, so a retried request cannot double-pay.
create function public.tip_post(p_post uuid, p_amount int, p_key uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare post public.daily_posts; me uuid := auth.uid(); k text; bal bigint;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into post from public.daily_posts where id = p_post;
  if not found or not public.is_household_member(post.household_id) then raise exception 'not found'; end if;
  if post.local_date <> public.household_today(post.household_id) then raise exception 'post expired'; end if;
  if post.user_id = me then raise exception 'cannot tip yourself'; end if;
  if p_amount is null or p_amount not between 1 and 100 then raise exception 'invalid amount'; end if;

  k := 'tip:' || me || ':' || p_key;
  if exists (select 1 from public.ledger_entries where idempotency_key = k || ':out') then return; end if;
  if (select count(*) from public.ledger_entries
      where user_id = me and kind = 'tip_out' and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'slow down';
  end if;

  perform public.ensure_wallet(me, post.household_id);
  perform public.ensure_wallet(post.user_id, post.household_id);
  perform 1 from public.wallets where user_id in (me, post.user_id) order by user_id for update;
  select balance into bal from public.wallets where user_id = me;
  if bal < p_amount then raise exception 'insufficient coins'; end if;

  perform public.post_ledger(me, post.household_id, -p_amount, 'tip_out', k || ':out', p_post::text, post.user_id);
  perform public.post_ledger(post.user_id, post.household_id, p_amount, 'tip_in', k || ':in', p_post::text, me);
end $$;

revoke all on function public.post_ledger, public.ensure_wallet from public, anon, authenticated;
revoke all on function public.my_wallet, public.claim_daily_reward, public.tip_post from public, anon;
grant execute on function public.my_wallet, public.claim_daily_reward, public.tip_post to authenticated;

alter publication supabase_realtime add table public.wallets;
