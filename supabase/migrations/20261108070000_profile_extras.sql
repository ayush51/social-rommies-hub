-- Profile photo, birthday, last seen. Visible to housemates through the existing profiles read policy.

alter table public.profiles
  add column dob date check (dob >= '1900-01-01'),
  add column last_seen_at timestamptz;

create function public.touch_last_seen() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke all on function public.touch_last_seen from public, anon;
grant execute on function public.touch_last_seen to authenticated;

-- Avatars: private bucket, path {household_id}/{user_id}/{file}, same rules as daily photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "avatars: members read" on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and exists (
    select 1 from public.household_members m
    where m.user_id = auth.uid() and m.household_id::text = (storage.foldername(name))[1])
);
create policy "avatars: upload to own folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text and exists (
    select 1 from public.household_members m
    where m.user_id = auth.uid() and m.household_id::text = (storage.foldername(name))[1])
);
create policy "avatars: delete own" on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text
);
