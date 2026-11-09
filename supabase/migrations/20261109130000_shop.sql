-- Shop: spend bingdons on badges, a spotlight, and a question pass.

alter table public.profiles
  add column badge text check (badge in ('star', 'crown')),
  add column spotlight_until timestamptz;

create table public.shop_items (
  code text primary key,
  name text not null,
  description text not null,
  price int not null check (price > 0),
  sort int not null default 0
);
insert into public.shop_items (code, name, description, price, sort) values
  ('badge_star', 'Gold star', 'A star next to your name', 150, 1),
  ('badge_crown', 'Crown', 'A crown next to your name', 400, 2),
  ('spotlight', 'Spotlight', 'Your status is pinned to the top of Home for 24 hours', 40, 3),
  ('question_pass', 'Question pass', 'Your next suggested daily-card question skips admin review', 60, 4);
alter table public.shop_items enable row level security;
create policy "everyone reads the shop" on public.shop_items for select to authenticated using (true);
revoke insert, update, delete, truncate on public.shop_items from anon, authenticated;

create table public.shop_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  item_code text not null references public.shop_items(code),
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index on public.shop_purchases (user_id, item_code);
alter table public.shop_purchases enable row level security;
create policy "read own purchases" on public.shop_purchases for select using (user_id = auth.uid());
revoke insert, update, delete, truncate on public.shop_purchases from anon, authenticated;

-- p_key is a client-generated uuid per tap, so a retried request cannot double-charge.
create function public.shop_buy(p_item text, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; it public.shop_items; k text; bal bigint; cur text;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  select * into it from public.shop_items where code = p_item;
  if not found then raise exception 'unknown item'; end if;
  k := 'shop:' || me || ':' || p_key;
  if exists (select 1 from public.ledger_entries where idempotency_key = k) then return jsonb_build_object('ok', true, 'replay', true); end if;

  if it.code like 'badge_%' then
    select badge into cur from public.profiles where id = me;
    if cur = substr(it.code, 7) then raise exception 'you already have that'; end if;
  end if;

  perform public.ensure_wallet(me, hid);
  select balance into bal from public.wallets where user_id = me for update;
  if bal < it.price then raise exception 'not enough bingdons'; end if;
  perform public.post_ledger(me, hid, -it.price, 'shop', k, it.code);

  insert into public.shop_purchases (user_id, household_id, item_code, used_at)
  values (me, hid, it.code, case when it.code = 'question_pass' then null else now() end);
  if it.code like 'badge_%' then update public.profiles set badge = substr(it.code, 7) where id = me;
  elsif it.code = 'spotlight' then update public.profiles set spotlight_until = now() + interval '24 hours' where id = me;
  end if;
  return jsonb_build_object('ok', true, 'item', it.code);
end $$;
revoke all on function public.shop_buy from public, anon;
grant execute on function public.shop_buy to authenticated;

-- a question pass skips admin review once
create or replace function public.suggest_question(p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; t text := btrim(p_text); pass uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  if t is null or char_length(t) not between 10 and 140 then raise exception 'invalid question'; end if;
  if lower(t) not like 'who''s most likely to %' then raise exception 'must start with Who''s most likely to'; end if;
  if right(t, 1) <> '?' then t := t || '?'; end if;
  if (select count(*) from public.card_suggestions where user_id = me and created_at > now() - interval '1 day') >= 5 then
    raise exception 'slow down';
  end if;
  if exists (select 1 from public.card_suggestions where household_id = hid and lower(text) = lower(t) and status <> 'rejected') then
    raise exception 'already suggested';
  end if;
  select id into pass from public.shop_purchases where user_id = me and item_code = 'question_pass' and used_at is null order by created_at limit 1 for update;
  if pass is not null then
    update public.shop_purchases set used_at = now() where id = pass;
    insert into public.card_suggestions (household_id, user_id, text, status, reviewed_at) values (hid, me, t, 'approved', now());
  else
    insert into public.card_suggestions (household_id, user_id, text) values (hid, me, t);
  end if;
end $$;

-- Badges and spotlight are bought, never self-edited: clients may only change these profile columns directly.
revoke update on public.profiles from anon, authenticated;
grant update (nickname, dob, avatar_url) on public.profiles to authenticated;
