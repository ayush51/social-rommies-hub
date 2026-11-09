-- Phase 5 RLS tests (plans, RSVPs, comments).
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  pb uuid; n int; denied boolean;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name) values (h1, 'H1'), (h2, 'H2');
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.plans (household_id, created_by, title, starts_at) values (h1, b, 'Taco night', now() + interval '1 day') returning id into pb;
  denied := false;
  begin insert into public.plans (household_id, created_by, title, starts_at) values (h1, a, 'spoof', now());
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: created plan as another user'; end if;
  denied := false;
  begin insert into public.plans (household_id, created_by, title, starts_at) values (h1, b, '', now());
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: empty title accepted'; end if;
  insert into public.plan_rsvps (plan_id, user_id, household_id, response) values (pb, b, h1, 'in');
  update public.plan_rsvps set response = 'maybe' where plan_id = pb and user_id = b;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: could not change own rsvp'; end if;
  denied := false;
  begin insert into public.plan_rsvps (plan_id, user_id, household_id, response) values (pb, a, h1, 'in');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: rsvp on behalf of another user'; end if;
  denied := false;
  begin insert into public.plan_rsvps (plan_id, user_id, household_id, response) values (pb, b, h1, 'yes');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: invalid rsvp value accepted'; end if;
  insert into public.plan_comments (plan_id, user_id, household_id, body) values (pb, b, h1, 'bringing salsa');
  reset role;

  -- member A (admin) can cancel B's plan; a plain member cannot edit another's plan
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.plans set status = 'cancelled' where id = pb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin could not cancel plan'; end if;
  insert into public.plans (household_id, created_by, title, starts_at) values (h1, a, 'Movie', now()) returning id into pb;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.plans set title = 'hijacked' where id = pb;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: member edited another member''s plan'; end if;
  reset role;

  -- outsider C
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select (select count(*) from public.plans) + (select count(*) from public.plan_rsvps)
       + (select count(*) from public.plan_comments) into n;
  if n <> 0 then raise exception 'FAIL: C sees H1 plan data (% rows)', n; end if;
  denied := false;
  begin insert into public.plan_rsvps (plan_id, user_id, household_id, response) values (pb, c, h2, 'in');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: C RSVP''d to an H1 plan'; end if;
  denied := false;
  begin insert into public.plan_comments (plan_id, user_id, household_id, body) values (pb, c, h1, 'hi');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: C commented on an H1 plan'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
