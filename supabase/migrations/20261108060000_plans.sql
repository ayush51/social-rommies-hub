-- Phase 5: group plans, RSVPs, comments.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 500),
  location text check (char_length(location) <= 120),
  starts_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now()
);
create index on public.plans (household_id, starts_at);

create table public.plan_rsvps (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  response text not null check (response in ('in', 'out', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index on public.plan_rsvps (household_id);

create table public.plan_comments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index on public.plan_comments (plan_id, created_at);

alter table public.plans enable row level security;
alter table public.plan_rsvps enable row level security;
alter table public.plan_comments enable row level security;

create policy "members read plans" on public.plans
  for select using (public.is_household_member(household_id));
create policy "create plan as self" on public.plans
  for insert with check (created_by = auth.uid() and public.is_household_member(household_id));
create policy "creator or admin edits plan" on public.plans
  for update using (created_by = auth.uid() or public.is_household_admin(household_id))
  with check (public.is_household_member(household_id));
create policy "creator or admin deletes plan" on public.plans
  for delete using (created_by = auth.uid() or public.is_household_admin(household_id));

create policy "members read rsvps" on public.plan_rsvps
  for select using (public.is_household_member(household_id));
create policy "rsvp as self" on public.plan_rsvps
  for insert with check (
    user_id = auth.uid() and public.is_household_member(household_id)
    and exists (select 1 from public.plans p where p.id = plan_id and p.household_id = plan_rsvps.household_id)
  );
create policy "change own rsvp" on public.plan_rsvps
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "remove own rsvp" on public.plan_rsvps
  for delete using (user_id = auth.uid());

create policy "members read plan comments" on public.plan_comments
  for select using (public.is_household_member(household_id));
create policy "comment on plan as self" on public.plan_comments
  for insert with check (
    user_id = auth.uid() and public.is_household_member(household_id)
    and exists (select 1 from public.plans p where p.id = plan_id and p.household_id = plan_comments.household_id)
  );
create policy "delete own or admin plan comment" on public.plan_comments
  for delete using (user_id = auth.uid() or public.is_household_admin(household_id));

create function public.limit_plan_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.plan_comments
      where user_id = new.user_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'slow down';
  end if;
  return new;
end $$;
create trigger plan_comments_rate_limit before insert on public.plan_comments
for each row execute function public.limit_plan_comments();

alter table public.plan_rsvps replica identity full;
alter publication supabase_realtime add table public.plans, public.plan_rsvps, public.plan_comments;
