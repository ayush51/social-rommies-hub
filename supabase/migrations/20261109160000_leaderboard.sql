-- Bingdon leaderboard: balances are already visible to the household; "week" is each person's net change over 7 days
-- (earnings, tips, bets, purchases), excluding the welcome bonus and admin corrections. Individual transactions stay private.
create function public.bingdon_leaderboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); hid uuid;
begin
  select household_id into hid from public.household_members where user_id = me;
  if hid is null then raise exception 'not in a household'; end if;
  return coalesce((
    select jsonb_agg(s.obj order by s.balance desc, s.name) from (
      select p.display_name as name, coalesce(w.balance, 0) as balance,
        jsonb_build_object(
          'user_id', m.user_id, 'name', p.display_name, 'avatar', p.avatar_url, 'badge', p.badge,
          'balance', coalesce(w.balance, 0),
          'week', coalesce((select sum(l.amount) from public.ledger_entries l
                            where l.user_id = m.user_id and l.created_at > now() - interval '7 days' and l.kind not in ('starting', 'adjustment')), 0)) as obj
      from public.household_members m
      join public.profiles p on p.id = m.user_id
      left join public.wallets w on w.user_id = m.user_id
      where m.household_id = hid) s), '[]'::jsonb);
end $$;
revoke all on function public.bingdon_leaderboard from public, anon;
grant execute on function public.bingdon_leaderboard to authenticated;
