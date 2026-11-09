-- Thirsty Thursdays: weekly "what should <cook> make" poll. State is derived from the household-local clock.

alter table public.households
  add column cook_name text not null default 'Jay' check (char_length(cook_name) between 1 and 30),
  add column poll_lock_dow int not null default 3 check (poll_lock_dow between 2 and 4), -- 2=Tue 3=Wed 4=Thu
  add column poll_lock_time time not null default '18:00';

alter table public.ledger_entries drop constraint ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in ('starting', 'daily', 'tip_out', 'tip_in', 'game', 'poll'));

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index dishes_unique_name on public.dishes (household_id, lower(name));

create table public.poll_votes (
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  dish_id uuid not null references public.dishes(id),
  voted_at timestamptz not null default now(),
  primary key (household_id, week_start, user_id)
);
create index on public.poll_votes (household_id, week_start, dish_id);

alter table public.dishes enable row level security;
alter table public.poll_votes enable row level security;
create policy "members read dishes" on public.dishes
  for select using (public.is_household_member(household_id));
create policy "admins add dishes" on public.dishes
  for insert with check (public.is_household_admin(household_id));
create policy "admins edit dishes" on public.dishes
  for update using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));
-- Individual votes stay private: poll_votes is reachable only through the functions below.
revoke all on public.poll_votes from anon, authenticated;
revoke delete, truncate on public.dishes from anon, authenticated;

-- Week runs Tuesday 00:00 -> next Monday, in the household's timezone. p_now is a parameter so tests can fix the clock.
create function public.poll_window(hid uuid, p_now timestamptz)
returns table (week_start date, lock_at timestamptz, cook_day date, phase text, cook_name text, lock_dow int, lock_time time)
language plpgsql stable security definer set search_path = '' as $$
declare h public.households; t timestamp; ws date; lock_local timestamp;
begin
  select * into h from public.households where id = hid;
  t := p_now at time zone h.timezone;
  ws := t::date - ((extract(dow from t)::int - 2 + 7) % 7);
  lock_local := (ws + ((h.poll_lock_dow - 2 + 7) % 7))::timestamp + h.poll_lock_time;
  return query select
    ws,
    lock_local at time zone h.timezone,
    ws + 2,
    case when t < lock_local then 'open' when t::date <= ws + 2 then 'locked' else 'done' end,
    h.cook_name, h.poll_lock_dow, h.poll_lock_time;
end $$;

create function public.poll_state(p_user uuid, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare hid uuid; w record; total int; win jsonb; mine uuid;
begin
  select household_id into hid from public.household_members where user_id = p_user;
  if hid is null then raise exception 'not in a household'; end if;
  select * into w from public.poll_window(hid, p_now);
  select count(*) into total from public.poll_votes where household_id = hid and week_start = w.week_start;
  select dish_id into mine from public.poll_votes where household_id = hid and week_start = w.week_start and user_id = p_user;

  if w.phase <> 'open' and total > 0 then
    select jsonb_build_object('id', d.id, 'name', d.name, 'votes', count(*)) into win
    from public.poll_votes v join public.dishes d on d.id = v.dish_id
    where v.household_id = hid and v.week_start = w.week_start
    group by d.id, d.name
    order by count(*) desc, md5(d.id::text || w.week_start::text) limit 1;
  end if;

  return jsonb_build_object(
    'phase', w.phase, 'week_start', w.week_start, 'lock_at', w.lock_at, 'cook_day', w.cook_day,
    'cook_name', w.cook_name, 'lock_dow', w.lock_dow, 'lock_time', w.lock_time,
    'total_votes', total,
    'members', (select count(*) from public.household_members where household_id = hid),
    'my_vote', mine,
    'winner', win,
    'dishes', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'votes', x.votes) order by x.votes desc, x.name)
      from (
        select d.id, d.name,
          (select count(*) from public.poll_votes v where v.dish_id = d.id and v.week_start = w.week_start) as votes
        from public.dishes d
        where d.household_id = hid
          and (d.active or exists (select 1 from public.poll_votes v where v.dish_id = d.id and v.week_start = w.week_start))
      ) x), '[]'::jsonb));
end $$;

create function public.do_vote(p_user uuid, p_dish uuid, p_now timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare hid uuid; w record; d public.dishes;
begin
  select household_id into hid from public.household_members where user_id = p_user;
  if hid is null then raise exception 'not in a household'; end if;
  select * into w from public.poll_window(hid, p_now);
  if w.phase <> 'open' then raise exception 'voting is closed'; end if;
  select * into d from public.dishes where id = p_dish;
  if not found or d.household_id <> hid or not d.active then raise exception 'unknown dish'; end if;

  insert into public.poll_votes (household_id, week_start, user_id, dish_id)
  values (hid, w.week_start, p_user, p_dish)
  on conflict (household_id, week_start, user_id) do update set dish_id = excluded.dish_id, voted_at = now();

  -- one participation reward per person per poll week, however many times they change their vote
  perform public.ensure_wallet(p_user, hid);
  perform public.post_ledger(p_user, hid, 5, 'poll', 'poll:' || hid || ':' || w.week_start || ':' || p_user);
end $$;

create function public.thursday_poll() returns jsonb
language sql security definer set search_path = '' as $$
  select public.poll_state(auth.uid(), now());
$$;

create function public.vote_dish(p_dish uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform public.do_vote(auth.uid(), p_dish, now());
end $$;

revoke all on function public.poll_window, public.poll_state, public.do_vote from public, anon, authenticated;
revoke all on function public.thursday_poll, public.vote_dish from public, anon;
grant execute on function public.thursday_poll, public.vote_dish to authenticated;
