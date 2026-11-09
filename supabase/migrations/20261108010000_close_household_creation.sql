-- Roommates are provisioned by the seed script; users can't create households.
revoke execute on function public.create_household from authenticated;
