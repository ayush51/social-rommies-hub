-- Phase 2: live statuses and household chat.

create table public.statuses (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 30),
  label text not null check (char_length(label) between 1 and 60),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on public.statuses (household_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.messages (household_id, created_at desc);

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index on public.message_reactions (household_id);

alter table public.statuses enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;

create policy "members read statuses" on public.statuses
  for select using (public.is_household_member(household_id));
create policy "set own status" on public.statuses
  for insert with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "update own status" on public.statuses
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "clear own status" on public.statuses
  for delete using (user_id = auth.uid());

create policy "members read messages" on public.messages
  for select using (public.is_household_member(household_id));
create policy "post own message" on public.messages
  for insert with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "delete own or admin" on public.messages
  for delete using (user_id = auth.uid() or public.is_household_admin(household_id));

create policy "members read reactions" on public.message_reactions
  for select using (public.is_household_member(household_id));
create policy "react as self" on public.message_reactions
  for insert with check (
    user_id = auth.uid() and public.is_household_member(household_id)
    and exists (select 1 from public.messages m where m.id = message_id and m.household_id = message_reactions.household_id)
  );
create policy "remove own reaction" on public.message_reactions
  for delete using (user_id = auth.uid());

-- Rate limit: 20 messages per user per minute.
create function public.limit_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages
      where user_id = new.user_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'slow down' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger messages_rate_limit before insert on public.messages
for each row execute function public.limit_messages();

alter table public.messages replica identity full;
alter table public.message_reactions replica identity full;
alter publication supabase_realtime add table public.messages, public.message_reactions, public.statuses;
