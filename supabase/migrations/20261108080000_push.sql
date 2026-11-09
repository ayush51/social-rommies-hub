-- Web push: device subscriptions + a function that decides who may be notified about what.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (household_id);

-- Dedupe so one event is announced once. No policies: only the functions below touch it.
create table public.push_log (
  ref text primary key,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security;
create policy "read own subscriptions" on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy "delete own subscriptions" on public.push_subscriptions
  for delete using (user_id = auth.uid());
revoke insert, update, truncate on public.push_subscriptions from anon, authenticated;
revoke all on public.push_log from anon, authenticated;

-- A shared phone may switch users, so an endpoint is re-assigned to whoever registers it last.
create function public.save_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  select household_id into hid from public.household_members where user_id = auth.uid();
  if hid is null then raise exception 'not in a household'; end if;
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth)
  values (auth.uid(), hid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, household_id = excluded.household_id,
        p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

create function public.drop_subscriptions(p_endpoints text[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions s
  using public.household_members m
  where m.user_id = auth.uid() and s.household_id = m.household_id and s.endpoint = any(p_endpoints);
$$;

-- Returns the devices to notify (housemates, not the sender) plus the text to show.
-- Only the author of a fresh row can trigger it, and each event only once.
create function public.push_targets(p_kind text, p_ref uuid)
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

revoke all on function public.save_subscription, public.drop_subscriptions, public.push_targets from public, anon;
grant execute on function public.save_subscription, public.drop_subscriptions, public.push_targets to authenticated;
