-- Scheduled reminders. pg_cron queues due reminders every 5 minutes, then pokes the app to deliver them as web push.
-- The shared secret lives in Vault (name: cron_secret) and in the CRON_SECRET env var; it is never stored in this repo.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create schema if not exists private;

create table public.reminder_outbox (
  id bigint generated always as identity primary key,
  kind text not null,
  ref text not null,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  body text not null,
  url text not null,
  recipients uuid[] not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (kind, ref)          -- each reminder fires once
);
alter table public.reminder_outbox enable row level security;
revoke all on public.reminder_outbox from anon, authenticated;

create function private.cron_secret_ok(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p is not null and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret = p);
$$;
revoke all on function private.cron_secret_ok from public, anon, authenticated;

create function public.poll_winner_name(hid uuid, ws date) returns text
language sql stable security definer set search_path = '' as $$
  select d.name from public.poll_votes v join public.dishes d on d.id = v.dish_id
  where v.household_id = hid and v.week_start = ws
  group by d.id, d.name order by count(*) desc, md5(d.id::text || ws::text) limit 1;
$$;
revoke all on function public.poll_winner_name from public, anon, authenticated;

-- p_now is a parameter only so tests can fix the clock; cron uses the default.
create function public.enqueue_reminders(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; c int; h record; w record; who uuid[]; win text; local_now timestamp;
begin
  insert into public.reminder_outbox (kind, ref, household_id, title, body, url, recipients)
  select 'plan_soon', p.id::text, p.household_id, p.title, 'Starting soon', '/plans/' || p.id,
         array(select r.user_id from public.plan_rsvps r where r.plan_id = p.id and r.response in ('in', 'maybe'))
  from public.plans p
  where p.status = 'scheduled' and p.starts_at > p_now and p.starts_at <= p_now + interval '60 minutes'
    and p.created_at < p_now - interval '10 minutes'
    and exists (select 1 from public.plan_rsvps r where r.plan_id = p.id and r.response in ('in', 'maybe'))
  on conflict (kind, ref) do nothing;
  get diagnostics c = row_count; n := n + c;

  for h in select id, cook_name, timezone from public.households loop
    select * into w from public.poll_window(h.id, p_now);
    if w.phase = 'open' then
      if w.lock_at - p_now <= interval '3 hours' and exists (select 1 from public.dishes where household_id = h.id and active) then
        who := array(select m.user_id from public.household_members m where m.household_id = h.id
                     and not exists (select 1 from public.poll_votes v
                                     where v.household_id = h.id and v.week_start = w.week_start and v.user_id = m.user_id));
        if cardinality(who) > 0 then
          insert into public.reminder_outbox (kind, ref, household_id, title, body, url, recipients)
          values ('poll_closing', h.id || ':' || w.week_start, h.id, 'Thirsty Thursday',
                  'Voting closes soon. What should ' || h.cook_name || ' cook?', '/thursday', who)
          on conflict (kind, ref) do nothing;
          get diagnostics c = row_count; n := n + c;
        end if;
      end if;
    else
      win := public.poll_winner_name(h.id, w.week_start);
      if win is not null then
        who := array(select user_id from public.household_members where household_id = h.id);
        insert into public.reminder_outbox (kind, ref, household_id, title, body, url, recipients)
        values ('poll_winner', h.id || ':' || w.week_start, h.id, 'Thirsty Thursday',
                h.cook_name || ' is making ' || win, '/thursday', who)
        on conflict (kind, ref) do nothing;
        get diagnostics c = row_count; n := n + c;

        local_now := p_now at time zone h.timezone;
        if local_now::date = w.cook_day and local_now::time >= time '09:00' then
          insert into public.reminder_outbox (kind, ref, household_id, title, body, url, recipients)
          values ('poll_day', h.id || ':' || w.week_start, h.id, 'Thirsty Thursday',
                  'Tonight: ' || h.cook_name || ' is making ' || win, '/thursday', who)
          on conflict (kind, ref) do nothing;
          get diagnostics c = row_count; n := n + c;
        end if;
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.enqueue_reminders from public, anon, authenticated;

-- Called by the app's cron endpoint with the shared secret. Marks rows sent (at-most-once) and returns devices to push to.
create function public.reminders_claim(p_secret text)
returns table (endpoint text, p256dh text, auth text, title text, body text, url text)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.cron_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  update public.reminder_outbox set sent_at = now() where sent_at is null and created_at < now() - interval '3 hours';
  return query
    with claimed as (
      update public.reminder_outbox o set sent_at = now() where o.sent_at is null returning o.title, o.body, o.url, o.recipients)
    select s.endpoint, s.p256dh, s.auth, c.title, c.body, c.url
    from claimed c join public.push_subscriptions s on s.user_id = any(c.recipients);
end $$;

create function public.reminders_drop(p_secret text, p_endpoints text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.cron_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  delete from public.push_subscriptions s where s.endpoint = any(p_endpoints);
end $$;

revoke all on function public.reminders_claim, public.reminders_drop from public;
grant execute on function public.reminders_claim, public.reminders_drop to anon, authenticated;

select cron.schedule('abingdon-reminders', '*/5 * * * *', $cron$
  select public.enqueue_reminders();
  select net.http_post(
    url := 'https://abingdon-bros.vercel.app/api/cron/reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from public.reminder_outbox where sent_at is null);
$cron$);
