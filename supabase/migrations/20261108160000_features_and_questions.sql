-- Feature requests (+ votes, comments) and community-suggested daily-card questions.
-- Also stores each day's question so history never changes when the pool grows.

-- ---------- daily card: stored day prompts + suggestions ----------
create table public.card_days (
  household_id uuid not null references public.households(id) on delete cascade,
  local_date date not null,
  prompt text not null,
  suggested_by uuid references public.profiles(id) on delete set null,
  primary key (household_id, local_date)
);
alter table public.card_days enable row level security;
revoke all on public.card_days from anon, authenticated;

-- freeze the questions already shown, using the formula that produced them
insert into public.card_days (household_id, local_date, prompt)
select distinct household_id, local_date, public.card_prompt_for(household_id, local_date) from public.card_picks
on conflict do nothing;

create table public.card_suggestions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 10 and 140),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  used_on date,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index on public.card_suggestions (household_id, status, created_at);
alter table public.card_suggestions enable row level security;
create policy "own or admin read suggestions" on public.card_suggestions
  for select using (user_id = auth.uid() or public.is_household_admin(household_id));
revoke insert, update, delete, truncate on public.card_suggestions from anon, authenticated;

create function public.suggest_question(p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; t text := btrim(p_text);
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
  insert into public.card_suggestions (household_id, user_id, text) values (hid, me, t);
end $$;

create function public.review_question(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.card_suggestions;
begin
  select * into s from public.card_suggestions where id = p_id for update;
  if not found or not public.is_household_admin(s.household_id) then raise exception 'not allowed'; end if;
  if s.status <> 'pending' then raise exception 'already reviewed'; end if;
  update public.card_suggestions set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now() where id = p_id;
end $$;

-- Today's question: stored on first view. Approved suggestions go first (oldest first); otherwise the stock rotation.
create function public.card_ensure_day(p_hid uuid, p_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.card_suggestions;
begin
  if exists (select 1 from public.card_days where household_id = p_hid and local_date = p_date) then return; end if;
  perform pg_advisory_xact_lock(hashtext(p_hid::text || p_date::text));
  if exists (select 1 from public.card_days where household_id = p_hid and local_date = p_date) then return; end if;
  select * into s from public.card_suggestions
    where household_id = p_hid and status = 'approved' and used_on is null order by reviewed_at, created_at limit 1 for update;
  if found then
    update public.card_suggestions set used_on = p_date where id = s.id;
    insert into public.card_days (household_id, local_date, prompt, suggested_by) values (p_hid, p_date, s.text, s.user_id);
  else
    insert into public.card_days (household_id, local_date, prompt) values (p_hid, p_date, public.card_prompt_for(p_hid, p_date));
  end if;
end $$;
revoke all on function public.card_ensure_day from public, anon, authenticated;

create or replace function public.card_today() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; d date; mine uuid; voted boolean; cd public.card_days;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  perform public.settle_cards(hid);
  d := public.household_today(hid);
  perform public.card_ensure_day(hid, d);
  select * into cd from public.card_days where household_id = hid and local_date = d;
  select pick_id into mine from public.card_picks where household_id = hid and local_date = d and voter_id = me;
  voted := mine is not null;
  return jsonb_build_object(
    'date', d,
    'prompt', cd.prompt,
    'suggested_by', (select display_name from public.profiles where id = cd.suggested_by),
    'voted', voted,
    'my_pick', mine,
    'members', (select count(*) from public.household_members where household_id = hid),
    'voted_count', (select count(*) from public.card_picks where household_id = hid and local_date = d),
    'options', (
      select jsonb_agg(jsonb_build_object(
        'id', m.user_id, 'name', p.display_name,
        'votes', case when voted then (select count(*) from public.card_picks k where k.household_id = hid and k.local_date = d and k.pick_id = m.user_id) end)
        order by p.display_name)
      from public.household_members m join public.profiles p on p.id = m.user_id
      where m.household_id = hid));
end $$;

create or replace function public.card_history(p_limit int default 7) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  perform public.settle_cards(hid);
  return jsonb_build_object(
    'rounds', coalesce((
      select jsonb_agg(rd order by (rd->>'date') desc) from (
        select jsonb_build_object(
          'date', cr.local_date,
          'prompt', coalesce((select cd.prompt from public.card_days cd where cd.household_id = hid and cd.local_date = cr.local_date),
                             public.card_prompt_for(hid, cr.local_date)),
          'winners', coalesce((select jsonb_agg(p.display_name) from public.profiles p where p.id = any(cr.winner_ids)), '[]'::jsonb),
          'results', coalesce((
            select jsonb_agg(jsonb_build_object('name', p.display_name, 'votes', t.c) order by t.c desc, p.display_name)
            from (select pick_id, count(*) c from public.card_picks k
                  where k.household_id = hid and k.local_date = cr.local_date group by pick_id) t
            join public.profiles p on p.id = t.pick_id), '[]'::jsonb)) as rd
        from public.card_results cr where cr.household_id = hid
        order by cr.local_date desc limit least(greatest(p_limit, 1), 30)) q), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.display_name, 'wins', s.wins) order by s.wins desc, p.display_name)
      from (select u as uid, count(*) as wins from public.card_results cr, unnest(cr.winner_ids) u
            where cr.household_id = hid group by u) s
      join public.profiles p on p.id = s.uid), '[]'::jsonb));
end $$;

-- Past questions, newest first, including days nobody voted.
create function public.card_past(p_days int default 7) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; today date;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  perform public.settle_cards(hid);
  today := public.household_today(hid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'date', cd.local_date, 'prompt', cd.prompt,
      'suggested_by', (select display_name from public.profiles where id = cd.suggested_by),
      'winners', coalesce((select jsonb_agg(p.display_name) from public.card_results cr join public.profiles p on p.id = any(cr.winner_ids)
                           where cr.household_id = hid and cr.local_date = cd.local_date), '[]'::jsonb),
      'voted_count', (select count(*) from public.card_picks k where k.household_id = hid and k.local_date = cd.local_date))
      order by cd.local_date desc)
    from public.card_days cd
    where cd.household_id = hid and cd.local_date < today and cd.local_date >= today - least(greatest(p_days, 1), 60)), '[]'::jsonb);
end $$;

revoke all on function public.suggest_question, public.review_question, public.card_past from public, anon;
grant execute on function public.suggest_question, public.review_question, public.card_past to authenticated;

-- ---------- feature requests ----------
create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 1000),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'building', 'shipped', 'rejected')),
  admin_note text check (char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.feature_requests (household_id, status, created_at desc);

create table public.feature_votes (
  request_id uuid not null references public.feature_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  primary key (request_id, user_id)
);
create index on public.feature_votes (household_id);

create table public.feature_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.feature_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index on public.feature_comments (request_id, created_at);

alter table public.feature_requests enable row level security;
alter table public.feature_votes enable row level security;
alter table public.feature_comments enable row level security;

create policy "members read requests" on public.feature_requests for select using (public.is_household_member(household_id));
create policy "propose as self" on public.feature_requests for insert
  with check (created_by = auth.uid() and status = 'proposed' and public.is_household_member(household_id));
create policy "admins review requests" on public.feature_requests for update
  using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));
create policy "withdraw own proposal" on public.feature_requests for delete
  using (created_by = auth.uid() and status = 'proposed');

create policy "members read votes" on public.feature_votes for select using (public.is_household_member(household_id));
create policy "vote as self" on public.feature_votes for insert with check (
  user_id = auth.uid() and public.is_household_member(household_id)
  and exists (select 1 from public.feature_requests r where r.id = request_id and r.household_id = feature_votes.household_id));
create policy "remove own vote" on public.feature_votes for delete using (user_id = auth.uid());

create policy "members read feature comments" on public.feature_comments for select using (public.is_household_member(household_id));
create policy "comment as self" on public.feature_comments for insert with check (
  user_id = auth.uid() and public.is_household_member(household_id)
  and exists (select 1 from public.feature_requests r where r.id = request_id and r.household_id = feature_comments.household_id));
create policy "delete own or admin feature comment" on public.feature_comments for delete
  using (user_id = auth.uid() or public.is_household_admin(household_id));

create function public.limit_feature_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feature_requests where created_by = new.created_by and created_at > now() - interval '1 day') >= 5 then
    raise exception 'slow down';
  end if;
  return new;
end $$;
create trigger feature_requests_rate_limit before insert on public.feature_requests
for each row execute function public.limit_feature_requests();

create function public.limit_feature_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feature_comments where user_id = new.user_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'slow down';
  end if;
  return new;
end $$;
create trigger feature_comments_rate_limit before insert on public.feature_comments
for each row execute function public.limit_feature_comments();

create function public.touch_feature_request() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger feature_requests_touch before update on public.feature_requests
for each row execute function public.touch_feature_request();

alter table public.feature_votes replica identity full;
alter publication supabase_realtime add table public.feature_requests, public.feature_votes, public.feature_comments;
