-- Phase 2 RLS tests (statuses, messages, reactions). Same conventions as rls.sql.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  mb uuid; ma uuid; n int; denied boolean;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name) values (h1, 'H1'), (h2, 'H2');
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (household_id, user_id, body) values (h1, b, 'hi') returning id into mb;
  denied := false;
  begin insert into public.messages (household_id, user_id, body) values (h1, a, 'spoof');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: posted message as another user'; end if;
  insert into public.message_reactions (message_id, user_id, household_id, emoji) values (mb, b, h1, 'x');
  denied := false;
  begin insert into public.message_reactions (message_id, user_id, household_id, emoji) values (mb, b, h1, 'x');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: duplicate reaction allowed'; end if;
  insert into public.statuses (user_id, household_id, kind, label) values (b, h1, 'gaming', 'Gaming');
  denied := false;
  begin insert into public.statuses (user_id, household_id, kind, label) values (a, h1, 'gaming', 'spoof');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: set status for another user'; end if;
  -- rate limit: 1 sent already, 19 more fine, the 21st is blocked
  insert into public.messages (household_id, user_id, body) select h1, b, 'm' || g from generate_series(1, 19) g;
  denied := false;
  begin insert into public.messages (household_id, user_id, body) values (h1, b, 'too many');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: rate limit not enforced'; end if;
  reset role;

  -- admin A: delete anyone's message; post own
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (household_id, user_id, body) values (h1, a, 'admin msg') returning id into ma;
  delete from public.messages where id = mb;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin could not delete member message'; end if;
  reset role;

  -- member B cannot delete A's message
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.messages where id = ma;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: member deleted another member message'; end if;
  reset role;

  -- outsider C sees and writes nothing in H1
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select (select count(*) from public.messages) + (select count(*) from public.statuses)
       + (select count(*) from public.message_reactions) into n;
  if n <> 0 then raise exception 'FAIL: C reads H1 chat data (% rows)', n; end if;
  denied := false;
  begin insert into public.messages (household_id, user_id, body) values (h1, c, 'intruder');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: C posted into H1'; end if;
  denied := false;
  begin insert into public.message_reactions (message_id, user_id, household_id, emoji) values (ma, c, h2, 'x');
  exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: C reacted to an H1 message'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
