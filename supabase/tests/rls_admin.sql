-- Admin dashboard: rewards config, validation, roommate management, error log, stats.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  newu uuid; n int; denied boolean; j jsonb; dish uuid; bal bigint; pw text;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name, timezone, starting_balance) values (h1, 'H1', 'UTC', 500), (h2, 'H2', 'UTC', 500);
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');
  update public.profiles set display_name = 'Ada' where id = a;
  update public.profiles set display_name = 'Bee' where id = b;

  -- ---- household validation + admin-only settings
  denied := false; begin update public.households set timezone = 'Mars/Phobos' where id = h1; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: invalid timezone accepted'; end if;
  denied := false; begin update public.households set daily_reset_time = '20:00' where id = h1; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: 8pm reset accepted'; end if;
  denied := false; begin update public.households set card_reward = 101 where id = h1; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: absurd reward accepted'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.households set card_reward = 99 where id = h1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: member changed household settings'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.households set timezone = 'America/New_York', daily_reset_time = '04:00', card_reward = 12, poll_reward = 0 where id = h1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin could not change settings'; end if;
  reset role;

  -- ---- configurable rewards
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.pick_card(a);
  reset role;
  select coalesce(sum(amount), 0) into bal from public.ledger_entries where user_id = b and kind = 'game';
  if bal <> 12 then raise exception 'FAIL: card reward should follow the setting (12), got %', bal; end if;
  insert into public.dishes (household_id, name) values (h1, 'Tacos') returning id into dish;
  perform public.do_vote(b, dish, '2026-11-04 12:00+00');
  if exists (select 1 from public.ledger_entries where user_id = b and kind = 'poll') then raise exception 'FAIL: poll reward 0 should pay nothing'; end if;
  update public.households set poll_reward = 7 where id = h1;
  perform public.do_vote(a, dish, '2026-11-04 12:00+00');
  select coalesce(sum(amount), 0) into bal from public.ledger_entries where user_id = a and kind = 'poll';
  if bal <> 7 then raise exception 'FAIL: poll reward should be 7, got %', bal; end if;

  -- ---- roster is public (names only)
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  j := public.login_roster();
  if jsonb_array_length(j) < 3 or not (j ? 'Ada') then raise exception 'FAIL: login roster: %', j; end if;
  denied := false; begin perform public.admin_stats(); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: anon can read stats'; end if;
  denied := false; begin perform public.admin_add_roommate('Eve', '482915'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: anon can add roommates'; end if;
  reset role;

  -- ---- role management
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.set_member_role(b, 'admin'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: member self-promoted'; end if;
  denied := false; begin perform public.admin_reset_code(a, '482915'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: member reset an admin code'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.set_member_role(a, 'member'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: last admin demoted'; end if;
  perform public.set_member_role(b, 'admin');
  perform public.set_member_role(a, 'member');   -- allowed now that B is also an admin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_member_role(a, 'admin');    -- B promotes A back
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.set_member_role(c, 'admin'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: changed a role in another household'; end if;
  perform public.set_member_role(b, 'member');

  -- ---- add roommate / reset code
  denied := false; begin perform public.admin_add_roommate('Ada', '482915'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: duplicate name accepted'; end if;
  denied := false; begin perform public.admin_add_roommate('Eve Smith', '482915'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: name with a space accepted'; end if;
  denied := false; begin perform public.admin_add_roommate('Eve', '111111'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: guessable code accepted'; end if;
  denied := false; begin perform public.admin_add_roommate('Eve', '12345'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: 5-digit code accepted'; end if;
  newu := public.admin_add_roommate('Eve', '482915');
  perform public.admin_reset_code(b, '739204');
  reset role;
  select encrypted_password into pw from auth.users where id = newu;
  if pw <> extensions.crypt('482915', pw) then raise exception 'FAIL: new roommate code does not verify'; end if;
  select encrypted_password into pw from auth.users where id = b;
  if pw <> extensions.crypt('739204', pw) then raise exception 'FAIL: reset code does not verify'; end if;
  if not exists (select 1 from public.household_members where user_id = newu and household_id = h1 and role = 'member') then raise exception 'FAIL: new roommate not a member'; end if;
  if (select display_name from public.profiles where id = newu) <> 'Eve' then raise exception 'FAIL: new roommate name'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.admin_reset_code(b, '618403'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: other household admin reset a code'; end if;
  reset role;

  -- ---- error log
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for n in 1..8 loop perform public.log_error('/x', 'boom ' || n, 'ua'); end loop;
  select count(*) into n from public.app_errors;
  if n <> 0 then raise exception 'FAIL: member can read the error log'; end if;
  reset role;
  select count(*) into n from public.app_errors where user_id = b;
  if n <> 5 then raise exception 'FAIL: error logging should cap at 5 per minute, got %', n; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.app_errors;
  if n <> 5 then raise exception 'FAIL: admin should see the 5 errors, got %', n; end if;
  denied := false; begin insert into public.app_errors (household_id, message) values (h1, 'x'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct error insert allowed'; end if;
  j := public.admin_stats();
  if (j->>'errors_7d')::int <> 5 or jsonb_array_length(j->'members') <> 3 then raise exception 'FAIL: stats shape: %', j; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.app_errors;
  if n <> 0 then raise exception 'FAIL: outsider sees H1 errors'; end if;
  reset role;
  update public.app_errors set created_at = now() - interval '40 days';
  perform public.enqueue_errlog_reminders();
  select count(*) into n from public.app_errors;
  if n <> 0 then raise exception 'FAIL: old errors not purged'; end if;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
