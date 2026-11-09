-- Shared hooks so independent features (pets, location, chess, ...) never need to rewrite shared functions.

-- 1. generic secret check (Vault names: cron_secret, chess_secret, ...)
create function private.secret_ok(p_name text, p_value text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_value is not null and exists (select 1 from vault.decrypted_secrets where name = p_name and decrypted_secret = p_value);
$$;
revoke all on function private.secret_ok from public, anon, authenticated;

-- 2. more ledger kinds up front (pets, shop); chess reuses game_stake / game_refund / game_win
alter table public.ledger_entries drop constraint ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in ('starting', 'daily', 'tip_out', 'tip_in', 'game', 'poll', 'adjustment', 'bet_out', 'bet_payout', 'bet_refund',
                  'game_stake', 'game_refund', 'game_win', 'pet_treat', 'pet_reward', 'shop'));

-- 3. generic push events: a feature's security-definer function calls emit_push_event(...) and returns the id;
--    the client then calls notify("event", id). push_targets verifies actor + freshness and dedupes.
create table public.push_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor uuid not null references public.profiles(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 30),
  title text not null check (char_length(title) <= 80),
  body text not null check (char_length(body) <= 200),
  url text not null check (url like '/%'),
  notify_user uuid references public.profiles(id) on delete cascade,   -- null = whole house except the actor
  created_at timestamptz not null default now()
);
create index on public.push_events (created_at);
alter table public.push_events enable row level security;
revoke all on public.push_events from anon, authenticated;

create function public.emit_push_event(p_household uuid, p_actor uuid, p_category text, p_title text, p_body text, p_url text, p_user uuid default null)
returns uuid language sql security definer set search_path = '' as $$
  insert into public.push_events (household_id, actor, category, title, body, url, notify_user)
  values (p_household, p_actor, p_category, left(p_title, 80), left(p_body, 200), p_url, p_user) returning id;
$$;
revoke all on function public.emit_push_event from public, anon, authenticated;

create or replace function public.push_targets(p_kind text, p_ref uuid)
returns table (endpoint text, p256dh text, auth text, title text, body text, url text)
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; who text; t text; b text; u text; n int; nu uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select display_name into who from public.profiles where id = me;

  if p_kind = 'message' then
    select m.household_id, who, left(coalesce(nullif(m.body, ''), 'Sent a photo'), 140),
           case when m.recipient_id is null then '/chat' else '/chat/dm/' || me end, m.recipient_id
      into hid, t, b, u, nu
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
  elsif p_kind = 'game' then
    select e.household_id, 'Abingdon Street', e.text, '/games/monopoly/' || e.game_id,
           case when e.notify_mode = 'user' then e.notify_user end
      into hid, t, b, u, nu
    from public.monopoly_events e
    where e.id = p_ref and e.actor = me and e.notify_mode <> 'none' and e.created_at > now() - interval '2 minutes';
  elsif p_kind = 'event' then
    select e.household_id, e.title, e.body, e.url, e.notify_user into hid, t, b, u, nu
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
    where s.household_id = hid and s.user_id <> me and (nu is null or s.user_id = nu);
end $$;

-- 4. reminder dispatcher: any zero-argument `public.enqueue_<name>_reminders() returns int` is run automatically
--    every 5 minutes (inserting into reminder_outbox with unique (kind, ref)). enqueue_reminders and
--    enqueue_market_reminders take a clock argument and are called explicitly.
create function public.enqueue_reminders_all() returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record; c int;
begin
  n := n + public.enqueue_reminders();
  n := n + public.enqueue_market_reminders();
  for r in
    select p.proname from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname ~ '^enqueue_[a-z0-9_]+_reminders$' and p.pronargs = 0 and p.prorettype = 'integer'::regtype
    order by p.proname
  loop
    execute format('select public.%I()', r.proname) into c;
    n := n + coalesce(c, 0);
  end loop;
  return n;
end $$;
revoke all on function public.enqueue_reminders_all from public, anon, authenticated;

select cron.schedule('abingdon-reminders', '*/5 * * * *', $cron$
  select public.enqueue_reminders_all();
  select net.http_post(
    url := 'https://abingdon-bros.vercel.app/api/cron/reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from public.reminder_outbox where sent_at is null);
$cron$);
