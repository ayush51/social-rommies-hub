-- reply_to must be qualified: unqualified, it resolved to the subquery row's own column.
drop policy if exists "post own message" on public.messages;
create policy "post own message" on public.messages for insert with check (
  user_id = auth.uid() and public.is_household_member(household_id)
  and (recipient_id is null or exists (select 1 from public.household_members m where m.household_id = messages.household_id and m.user_id = messages.recipient_id))
  and (reply_to is null or exists (select 1 from public.messages r where r.id = messages.reply_to and r.household_id = messages.household_id)));
