-- Rally = a push notification to the house, no chat message. Stored so the push can be authorised, deduped and rate-limited.

create table public.rallies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  created_at timestamptz not null default now()
);
create index on public.rallies (household_id, created_at desc);
alter table public.rallies enable row level security;
create policy "members read rallies" on public.rallies
  for select using (public.is_household_member(household_id));
revoke insert, update, delete, truncate on public.rallies from anon, authenticated;

create function public.start_rally(p_label text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; t text := btrim(p_label); rid uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  if t is null or char_length(t) not between 1 and 60 then raise exception 'invalid activity'; end if;
  if exists (select 1 from public.rallies where user_id = me and created_at > now() - interval '1 minute') then
    raise exception 'slow down';
  end if;
  insert into public.rallies (household_id, user_id, label) values (hid, me, t) returning id into rid;
  return rid;
end $$;
revoke all on function public.start_rally from public, anon;
grant execute on function public.start_rally to authenticated;

-- Same as before plus a 'rally' kind.
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
