-- Daily fill-in-the-blank card game. All access goes through the functions below (no direct table access).

create table public.card_prompts (
  id int generated always as identity primary key,
  text text not null unique check (char_length(text) between 5 and 200)
);

create table public.card_answers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  answer text not null check (char_length(answer) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);
create index on public.card_answers (household_id, local_date);

create table public.card_votes (
  answer_id uuid not null references public.card_answers(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  local_date date not null,
  unique (voter_id, local_date)
);
create index on public.card_votes (answer_id);

create table public.card_results (
  household_id uuid not null references public.households(id) on delete cascade,
  local_date date not null,
  winner_ids uuid[] not null default '{}',
  settled_at timestamptz not null default now(),
  primary key (household_id, local_date)
);

alter table public.card_prompts enable row level security;
alter table public.card_answers enable row level security;
alter table public.card_votes enable row level security;
alter table public.card_results enable row level security;
revoke all on public.card_prompts, public.card_answers, public.card_votes, public.card_results from anon, authenticated;

alter table public.ledger_entries drop constraint ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in ('starting', 'daily', 'tip_out', 'tip_in', 'game'));

insert into public.card_prompts (text) values
  ('The real reason the dishes are still in the sink: ____.'),
  ('Our landlord would be horrified to learn about ____.'),
  ('Tonight''s group chat was derailed by ____.'),
  ('Nobody warned me that living with roommates meant ____.'),
  ('The fridge contains exactly one item: ____.'),
  ('I was going to clean today, but then ____.'),
  ('The smell coming from the bathroom is best described as ____.'),
  ('Abingdon Street''s newest house rule: no ____ after 10 p.m.'),
  ('What''s really inside the shared Tupperware: ____.'),
  ('My secret cooking ingredient is ____.'),
  ('The Wi-Fi is slow because someone is streaming ____.'),
  ('If this house had a mascot, it would be ____.'),
  ('The neighbors have filed a complaint about ____.'),
  ('Tomorrow''s group workout will consist entirely of ____.'),
  ('The couch has seen things, mostly ____.'),
  ('I knew it was a bad idea when someone suggested ____.'),
  ('The last person to take out the trash was clearly distracted by ____.'),
  ('My biggest red flag as a roommate is ____.'),
  ('The unofficial house motto: "____ or nothing."'),
  ('Instead of paying rent this month, I offered ____.'),
  ('The mystery stain on the carpet is probably ____.'),
  ('At 3 a.m. I heard someone in the kitchen practicing ____.'),
  ('The group project nobody asked for: ____.'),
  ('Thirsty Thursday was ruined by ____.'),
  ('Our house is famous in the neighborhood for ____.'),
  ('The smoke alarm went off because of ____.'),
  ('The best excuse for missing a house meeting: ____.'),
  ('I just found out the thermostat is controlled by ____.'),
  ('The package on the porch turned out to be ____.'),
  ('My most embarrassing search history entry: "how to ____".'),
  ('The reason we can''t have nice things: ____.'),
  ('Next week''s house meeting agenda: ____.'),
  ('The fire drill revealed that everyone panics about ____.'),
  ('A wise roommate once said, "Never trust ____."'),
  ('The leftovers labeled "DO NOT TOUCH" were actually ____.'),
  ('We were all quietly judging the person who brought ____.'),
  ('The only thing worse than a full sink is ____.'),
  ('Movie night is cancelled due to ____.'),
  ('The one thing we all agree on: ____.'),
  ('Rent is due, and so is ____.');

-- Same prompt for everyone in a household on a given date; no scheduler needed.
create function public.card_prompt_for(hid uuid, d date) returns text
language sql stable security definer set search_path = '' as $$
  select text from public.card_prompts order by id
  offset ((hashtext(hid::text || d::text)::bigint & 2147483647) % (select count(*) from public.card_prompts))
  limit 1;
$$;

-- Pays out finished rounds exactly once (results row + deterministic ledger keys).
create function public.settle_cards(p_hid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; maxv int; winners uuid[]; n int; w uuid;
begin
  for r in
    select distinct a.local_date as d from public.card_answers a
    where a.household_id = p_hid and a.local_date < public.household_today(p_hid)
      and not exists (select 1 from public.card_results cr where cr.household_id = p_hid and cr.local_date = a.local_date)
  loop
    select max(c) into maxv from (
      select count(v.answer_id) as c from public.card_answers a
      left join public.card_votes v on v.answer_id = a.id
      where a.household_id = p_hid and a.local_date = r.d group by a.id) t;
    if maxv >= 1 then
      winners := array(
        select a.user_id from public.card_answers a
        where a.household_id = p_hid and a.local_date = r.d
          and (select count(*) from public.card_votes v where v.answer_id = a.id) = maxv);
    else
      winners := '{}';
    end if;
    insert into public.card_results (household_id, local_date, winner_ids) values (p_hid, r.d, winners)
    on conflict do nothing;
    get diagnostics n = row_count;
    if n = 1 then
      foreach w in array winners loop
        perform public.post_ledger(w, p_hid, 50, 'game', 'cards:' || p_hid || ':' || r.d || ':' || w);
      end loop;
    end if;
  end loop;
end $$;

create function public.card_today() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; d date; mine uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  perform public.settle_cards(hid);
  d := public.household_today(hid);
  select id into mine from public.card_answers where user_id = me and local_date = d;
  return jsonb_build_object(
    'date', d,
    'prompt', public.card_prompt_for(hid, d),
    'answered', mine is not null,
    'members', (select count(*) from public.household_members where household_id = hid),
    'answered_count', (select count(*) from public.card_answers where household_id = hid and local_date = d),
    -- answers are anonymous and only visible once you have answered yourself
    'answers', case when mine is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'text', a.answer, 'mine', a.user_id = me,
        'voted', exists (select 1 from public.card_votes v where v.answer_id = a.id and v.voter_id = me))
        order by md5(a.id::text))
      from public.card_answers a where a.household_id = hid and a.local_date = d), '[]'::jsonb) end);
end $$;

create function public.submit_card_answer(p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; t text := btrim(p_text);
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  if t is null or char_length(t) not between 1 and 100 then raise exception 'invalid answer'; end if;
  begin
    insert into public.card_answers (household_id, user_id, local_date, answer)
    values (hid, me, public.household_today(hid), t);
  exception when unique_violation then
    raise exception 'already answered today';
  end;
end $$;

create function public.vote_card(p_answer uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid; d date; a public.card_answers;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  d := public.household_today(hid);
  if not exists (select 1 from public.card_answers where user_id = me and local_date = d) then
    raise exception 'answer first';
  end if;
  select * into a from public.card_answers where id = p_answer;
  if not found or a.household_id <> hid or a.local_date <> d then raise exception 'not found'; end if;
  if a.user_id = me then raise exception 'cannot vote for yourself'; end if;
  insert into public.card_votes (answer_id, voter_id, household_id, local_date) values (p_answer, me, hid, d)
  on conflict (voter_id, local_date) do update set answer_id = excluded.answer_id;
end $$;

create function public.card_history(p_limit int default 7) returns jsonb
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
          'prompt', public.card_prompt_for(hid, cr.local_date),
          'winners', coalesce((select jsonb_agg(p.display_name) from public.profiles p where p.id = any(cr.winner_ids)), '[]'::jsonb),
          'answers', coalesce((
            select jsonb_agg(jsonb_build_object('text', a.answer, 'author', p.display_name,
              'votes', (select count(*) from public.card_votes v where v.answer_id = a.id))
              order by (select count(*) from public.card_votes v where v.answer_id = a.id) desc)
            from public.card_answers a join public.profiles p on p.id = a.user_id
            where a.household_id = hid and a.local_date = cr.local_date), '[]'::jsonb)) as rd
        from public.card_results cr where cr.household_id = hid
        order by cr.local_date desc limit least(greatest(p_limit, 1), 30)) q), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.display_name, 'wins', s.wins) order by s.wins desc, p.display_name)
      from (select u as uid, count(*) as wins from public.card_results cr, unnest(cr.winner_ids) u
            where cr.household_id = hid group by u) s
      join public.profiles p on p.id = s.uid), '[]'::jsonb));
end $$;

revoke all on function public.card_prompt_for, public.settle_cards from public, anon, authenticated;
revoke all on function public.card_today, public.submit_card_answer, public.vote_card, public.card_history from public, anon;
grant execute on function public.card_today, public.submit_card_answer, public.vote_card, public.card_history to authenticated;
