-- Prediction markets: bet bingdons on roommate-hosted questions. Parimutuel (winners split the pool), no house cut.

alter table public.ledger_entries drop constraint ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in ('starting', 'daily', 'tip_out', 'tip_in', 'game', 'poll', 'adjustment', 'bet_out', 'bet_payout', 'bet_refund'));

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  resolver_id uuid not null references public.profiles(id),
  question text not null check (char_length(question) between 5 and 140),
  description text check (char_length(description) <= 500),
  closes_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'cancelled')),
  resolved_option_id uuid,
  resolved_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now()
);
create index on public.markets (household_id, created_at desc);

create table public.market_options (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  position int not null,
  unique (market_id, position)
);
alter table public.markets add constraint markets_resolved_option_fk
  foreign key (resolved_option_id) references public.market_options(id);

create table public.market_bets (
  market_id uuid not null references public.markets(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  option_id uuid not null references public.market_options(id),
  household_id uuid not null references public.households(id) on delete cascade,
  amount int not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (market_id, user_id)
);
create index on public.market_bets (household_id);

alter table public.markets enable row level security;
alter table public.market_options enable row level security;
alter table public.market_bets enable row level security;
create policy "members read markets" on public.markets for select using (public.is_household_member(household_id));
create policy "members read options" on public.market_options for select using (
  exists (select 1 from public.markets m where m.id = market_id and public.is_household_member(m.household_id)));
create policy "members read bets" on public.market_bets for select using (public.is_household_member(household_id));
revoke insert, update, delete, truncate on public.markets, public.market_options, public.market_bets from anon, authenticated;

create function public.create_market(p_question text, p_description text, p_options text[], p_closes_at timestamptz, p_resolver uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; q text := btrim(p_question); opts text[]; mid uuid; i int;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  if q is null or char_length(q) not between 5 and 140 then raise exception 'invalid question'; end if;
  if p_description is not null and char_length(p_description) > 500 then raise exception 'description too long'; end if;
  select array_agg(btrim(x) order by ord) into opts from unnest(p_options) with ordinality t(x, ord);
  if opts is null or cardinality(opts) not between 2 and 4 then raise exception 'need 2 to 4 options'; end if;
  if exists (select 1 from unnest(opts) x where char_length(x) not between 1 and 40) then raise exception 'invalid option'; end if;
  if (select count(distinct lower(x)) from unnest(opts) x) <> cardinality(opts) then raise exception 'duplicate options'; end if;
  if p_closes_at is null or p_closes_at <= now() + interval '1 minute' or p_closes_at > now() + interval '60 days' then
    raise exception 'invalid closing time';
  end if;
  if not exists (select 1 from public.household_members where household_id = hid and user_id = p_resolver) then
    raise exception 'resolver must be a roommate';
  end if;
  if (select count(*) from public.markets where created_by = me and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'slow down';
  end if;
  insert into public.markets (household_id, created_by, resolver_id, question, description, closes_at)
  values (hid, me, p_resolver, q, nullif(btrim(p_description), ''), p_closes_at) returning id into mid;
  for i in 1 .. cardinality(opts) loop
    insert into public.market_options (market_id, label, position) values (mid, opts[i], i);
  end loop;
  return mid;
end $$;

-- p_key is a client-generated uuid per tap so a retried request cannot double-charge.
create function public.place_bet(p_market uuid, p_option uuid, p_amount int, p_key uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); m public.markets; k text; existing public.market_bets; bal bigint;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into m from public.markets where id = p_market for update;
  if not found or not public.is_household_member(m.household_id) then raise exception 'not found'; end if;
  if m.status <> 'open' or now() >= m.closes_at then raise exception 'betting is closed'; end if;
  if m.resolver_id = me then raise exception 'the resolver cannot bet'; end if;
  if not exists (select 1 from public.market_options where id = p_option and market_id = p_market) then raise exception 'unknown option'; end if;
  if p_amount is null or p_amount not between 1 and 500 then raise exception 'invalid amount'; end if;

  k := 'bet:' || p_market || ':' || me || ':' || p_key;
  if exists (select 1 from public.ledger_entries where idempotency_key = k || ':out') then return; end if;

  select * into existing from public.market_bets where market_id = p_market and user_id = me;
  if found and existing.option_id <> p_option then raise exception 'you already backed another option'; end if;

  perform public.ensure_wallet(me, m.household_id);
  select balance into bal from public.wallets where user_id = me for update;
  if bal < p_amount then raise exception 'insufficient bingdons'; end if;

  perform public.post_ledger(me, m.household_id, -p_amount, 'bet_out', k || ':out', p_market::text);
  insert into public.market_bets (market_id, user_id, option_id, household_id, amount)
  values (p_market, me, p_option, m.household_id, p_amount)
  on conflict (market_id, user_id) do update set amount = public.market_bets.amount + excluded.amount, updated_at = now();
end $$;

create function public.resolve_market(p_market uuid, p_option uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); m public.markets; pool bigint; win_pool bigint; dust bigint; dust_user uuid; b record; share bigint;
begin
  select * into m from public.markets where id = p_market for update;
  if not found or not public.is_household_member(m.household_id) then raise exception 'not found'; end if;
  if m.resolver_id <> me and not public.is_household_admin(m.household_id) then raise exception 'only the resolver can resolve'; end if;
  if m.status <> 'open' then raise exception 'already settled'; end if;
  if not exists (select 1 from public.market_options where id = p_option and market_id = p_market) then raise exception 'unknown option'; end if;

  select coalesce(sum(amount), 0) into pool from public.market_bets where market_id = p_market;
  select coalesce(sum(amount), 0) into win_pool from public.market_bets where market_id = p_market and option_id = p_option;

  if win_pool = 0 then
    -- nobody backed the outcome: everyone is refunded
    for b in select user_id, amount from public.market_bets where market_id = p_market order by user_id loop
      perform public.post_ledger(b.user_id, m.household_id, b.amount, 'bet_refund', 'bet:' || p_market || ':' || b.user_id || ':refund', p_market::text);
    end loop;
    update public.markets set status = 'cancelled', cancel_reason = 'Nobody backed the winning outcome, so everyone was refunded.',
      resolved_at = now() where id = p_market;
    return;
  end if;

  -- winners split the pool pro rata; the rounding remainder goes to the biggest winner so nothing is lost
  select pool - coalesce(sum(amount::bigint * pool / win_pool), 0) into dust
    from public.market_bets where market_id = p_market and option_id = p_option;
  select user_id into dust_user from public.market_bets where market_id = p_market and option_id = p_option
    order by amount desc, created_at, user_id limit 1;
  for b in select user_id, amount from public.market_bets where market_id = p_market and option_id = p_option order by user_id loop
    share := b.amount::bigint * pool / win_pool + case when b.user_id = dust_user then dust else 0 end;
    perform public.post_ledger(b.user_id, m.household_id, share, 'bet_payout', 'bet:' || p_market || ':' || b.user_id || ':payout', p_market::text);
  end loop;
  update public.markets set status = 'resolved', resolved_option_id = p_option, resolved_at = now() where id = p_market;
end $$;

create function public.cancel_market(p_market uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); m public.markets; b record;
begin
  select * into m from public.markets where id = p_market for update;
  if not found or not public.is_household_member(m.household_id) then raise exception 'not found'; end if;
  if m.resolver_id <> me and m.created_by <> me and not public.is_household_admin(m.household_id) then raise exception 'not allowed'; end if;
  if m.status <> 'open' then raise exception 'already settled'; end if;
  for b in select user_id, amount from public.market_bets where market_id = p_market order by user_id loop
    perform public.post_ledger(b.user_id, m.household_id, b.amount, 'bet_refund', 'bet:' || p_market || ':' || b.user_id || ':refund', p_market::text);
  end loop;
  update public.markets set status = 'cancelled', cancel_reason = coalesce(nullif(btrim(p_reason), ''), 'Cancelled. Everyone was refunded.'), resolved_at = now()
  where id = p_market;
end $$;

revoke all on function public.create_market, public.place_bet, public.resolve_market, public.cancel_market from public, anon;
grant execute on function public.create_market, public.place_bet, public.resolve_market, public.cancel_market to authenticated;

-- Push for new markets (same rules as the other kinds: author-only, fresh, once).
create or replace function public.push_targets(p_kind text, p_ref uuid)
returns table (endpoint text, p256dh text, auth text, title text, body text, url text)
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; who text; t text; b text; u text; n int;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select display_name into who from public.profiles where id = me;

  if p_kind = 'message' then
    select m.household_id, who, left(m.body, 140), '/chat' into hid, t, b, u
    from public.messages m where m.id = p_ref and m.user_id = me and m.created_at > now() - interval '2 minutes';
  elsif p_kind = 'plan' then
    select p.household_id, 'New plan', who || ': ' || p.title, '/plans/' || p.id into hid, t, b, u
    from public.plans p where p.id = p_ref and p.created_by = me and p.created_at > now() - interval '2 minutes';
  elsif p_kind = 'post' then
    select d.household_id, who || ' posted today''s photo', coalesce(d.caption, 'Take a look'), '/daily' into hid, t, b, u
    from public.daily_posts d where d.id = p_ref and d.user_id = me and d.created_at > now() - interval '2 minutes';
  elsif p_kind = 'rally' then
    select r.household_id, who || ' is rallying the house', r.label || '. Who''s in?', '/' into hid, t, b, u
    from public.rallies r where r.id = p_ref and r.user_id = me and r.created_at > now() - interval '2 minutes';
  elsif p_kind = 'market' then
    select k.household_id, who || ' started a prediction', k.question, '/predictions/' || k.id into hid, t, b, u
    from public.markets k where k.id = p_ref and k.created_by = me and k.created_at > now() - interval '2 minutes';
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
    where s.household_id = hid and s.user_id <> me;
end $$;

-- Nudge the resolver once betting has closed and the market is still waiting on them.
create function public.enqueue_market_reminders(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare c int;
begin
  insert into public.reminder_outbox (kind, ref, household_id, title, body, url, recipients)
  select 'market_due', m.id::text, m.household_id, 'Time to call it', m.question, '/predictions/' || m.id, array[m.resolver_id]
  from public.markets m
  where m.status = 'open' and m.closes_at <= p_now and m.closes_at > p_now - interval '3 days'
  on conflict (kind, ref) do nothing;
  get diagnostics c = row_count;
  return c;
end $$;
revoke all on function public.enqueue_market_reminders from public, anon, authenticated;

select cron.schedule('abingdon-reminders', '*/5 * * * *', $cron$
  select public.enqueue_reminders();
  select public.enqueue_market_reminders();
  select net.http_post(
    url := 'https://abingdon-bros.vercel.app/api/cron/reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from public.reminder_outbox where sent_at is null);
$cron$);

alter publication supabase_realtime add table public.markets, public.market_bets;
