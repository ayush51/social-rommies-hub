-- Chat upgrades: direct messages, photos, replies. DM privacy is enforced by RLS (messages, reactions, storage).

alter table public.messages
  add column recipient_id uuid references public.profiles(id) on delete cascade,
  add column image_path text,
  add column reply_to uuid references public.messages(id) on delete set null;
alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check
  check (char_length(body) <= 2000 and (char_length(body) > 0 or image_path is not null));
alter table public.messages add constraint messages_no_self_dm check (recipient_id is null or recipient_id <> user_id);
create index on public.messages (household_id, recipient_id, created_at desc);

drop policy "members read messages" on public.messages;
drop policy "post own message" on public.messages;
drop policy "delete own or admin" on public.messages;

create policy "read group chat and my DMs" on public.messages for select using (
  public.is_household_member(household_id) and (recipient_id is null or user_id = auth.uid() or recipient_id = auth.uid()));
create policy "post own message" on public.messages for insert with check (
  user_id = auth.uid() and public.is_household_member(household_id)
  and (recipient_id is null or exists (select 1 from public.household_members m where m.household_id = messages.household_id and m.user_id = messages.recipient_id))
  and (reply_to is null or exists (select 1 from public.messages r where r.id = messages.reply_to and r.household_id = messages.household_id)));
-- admins can moderate the group chat, never DMs
create policy "delete own, admin moderates group" on public.messages for delete using (
  user_id = auth.uid() or (recipient_id is null and public.is_household_admin(household_id)));

-- reactions follow the visibility of their message
drop policy "members read reactions" on public.message_reactions;
create policy "read reactions on visible messages" on public.message_reactions for select using (
  exists (select 1 from public.messages m where m.id = message_id));

-- photos: private bucket; readable only when attached to a message you can see (so DM photos stay private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "chat: upload to own folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat' and (storage.foldername(name))[2] = auth.uid()::text and exists (
    select 1 from public.household_members m where m.user_id = auth.uid() and m.household_id::text = (storage.foldername(name))[1]));
create policy "chat: read images of visible messages" on storage.objects for select to authenticated using (
  bucket_id = 'chat' and ((storage.foldername(name))[2] = auth.uid()::text
    or exists (select 1 from public.messages m where m.image_path = storage.objects.name)));
create policy "chat: delete own" on storage.objects for delete to authenticated using (
  bucket_id = 'chat' and (storage.foldername(name))[2] = auth.uid()::text);

-- push: DMs go only to the recipient
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
