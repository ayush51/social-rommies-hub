-- Phase 4: daily photos. Expiry is enforced by RLS on the household-local date;
-- past posts are reachable only through memories() (members only). Nothing is deleted at expiry.

create function public.household_today(hid uuid) returns date
language sql stable security definer set search_path = '' as $$
  select ((now() at time zone h.timezone) - h.daily_reset_time::interval)::date
  from public.households h where h.id = hid;
$$;
revoke all on function public.household_today from public, anon;
grant execute on function public.household_today to authenticated;

create table public.daily_posts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  photo_path text not null,
  selfie_path text,
  caption text check (char_length(caption) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);
create index on public.daily_posts (household_id, local_date desc);

create function public.set_post_date() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.local_date := public.household_today(new.household_id);
  return new;
end $$;
create trigger daily_posts_date before insert on public.daily_posts
for each row execute function public.set_post_date();

create table public.post_reactions (
  post_id uuid not null references public.daily_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  primary key (post_id, user_id, emoji)
);
create index on public.post_reactions (household_id);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.daily_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index on public.post_comments (post_id, created_at);

alter table public.daily_posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;

create policy "read today's posts" on public.daily_posts
  for select using (public.is_household_member(household_id) and local_date = public.household_today(household_id));
create policy "post as self" on public.daily_posts
  for insert with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "edit own post today" on public.daily_posts
  for update using (user_id = auth.uid() and local_date = public.household_today(household_id))
  with check (user_id = auth.uid());
create policy "delete own or admin" on public.daily_posts
  for delete using (user_id = auth.uid() or public.is_household_admin(household_id));

-- Reactions and comments inherit visibility: the EXISTS sees only today's posts the caller may read.
create policy "read reactions" on public.post_reactions
  for select using (public.is_household_member(household_id));
create policy "react as self" on public.post_reactions
  for insert with check (
    user_id = auth.uid() and public.is_household_member(household_id)
    and exists (select 1 from public.daily_posts p where p.id = post_id and p.household_id = post_reactions.household_id)
  );
create policy "remove own reaction" on public.post_reactions
  for delete using (user_id = auth.uid());

create policy "read comments" on public.post_comments
  for select using (public.is_household_member(household_id));
create policy "comment as self" on public.post_comments
  for insert with check (
    user_id = auth.uid() and public.is_household_member(household_id)
    and exists (select 1 from public.daily_posts p where p.id = post_id and p.household_id = post_comments.household_id)
  );
create policy "delete own or admin comment" on public.post_comments
  for delete using (user_id = auth.uid() or public.is_household_admin(household_id));

create function public.limit_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.post_comments
      where user_id = new.user_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'slow down';
  end if;
  return new;
end $$;
create trigger comments_rate_limit before insert on public.post_comments
for each row execute function public.limit_comments();

-- Memories: archived (past-day) posts, members only.
create function public.memories(p_household uuid, p_limit int default 60)
returns setof public.daily_posts
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_household_member(p_household) then raise exception 'forbidden'; end if;
  return query
    select * from public.daily_posts
    where household_id = p_household and local_date < public.household_today(p_household)
    order by local_date desc, created_at desc
    limit least(p_limit, 200);
end $$;
revoke all on function public.memories from public, anon;
grant execute on function public.memories to authenticated;

-- Private storage: path is {household_id}/{user_id}/{file}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('daily', 'daily', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "daily: members read" on storage.objects for select to authenticated using (
  bucket_id = 'daily' and exists (
    select 1 from public.household_members m
    where m.user_id = auth.uid() and m.household_id::text = (storage.foldername(name))[1])
);
create policy "daily: upload to own folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'daily' and (storage.foldername(name))[2] = auth.uid()::text and exists (
    select 1 from public.household_members m
    where m.user_id = auth.uid() and m.household_id::text = (storage.foldername(name))[1])
);
create policy "daily: delete own" on storage.objects for delete to authenticated using (
  bucket_id = 'daily' and (storage.foldername(name))[2] = auth.uid()::text
);

alter table public.post_reactions replica identity full;
alter publication supabase_realtime add table public.daily_posts, public.post_reactions, public.post_comments;
