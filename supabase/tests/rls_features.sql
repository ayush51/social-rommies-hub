-- Feature requests + suggested daily-card questions.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  f1 uuid; f2 uuid; s1 uuid; n int; denied boolean; j jsonb; today date; yday date := current_date - 3;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name, timezone) values (h1, 'H1', 'UTC'), (h2, 'H2', 'UTC');
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');
  insert into public.profiles (id, display_name) values (a, 'Admin') on conflict (id) do update set display_name = 'Admin';
  update public.profiles set display_name = 'Bee' where id = b;

  -- ---- feature requests (as B)
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.feature_requests (household_id, created_by, title, description) values (h1, b, 'Dark mode toggle', 'please') returning id into f1;
  denied := false; begin insert into public.feature_requests (household_id, created_by, title) values (h1, a, 'spoofed'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: proposed as another user'; end if;
  denied := false; begin insert into public.feature_requests (household_id, created_by, title, status) values (h1, b, 'self-approved', 'approved'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: created a request already approved'; end if;
  denied := false; begin insert into public.feature_requests (household_id, created_by, title) values (h1, b, 'x'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: 1-char title accepted'; end if;
  insert into public.feature_votes (request_id, user_id, household_id) values (f1, b, h1);
  denied := false; begin insert into public.feature_votes (request_id, user_id, household_id) values (f1, b, h1); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: double vote accepted'; end if;
  insert into public.feature_comments (request_id, user_id, household_id, body) values (f1, b, h1, 'yes please');
  update public.feature_requests set status = 'approved' where id = f1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: member approved their own request'; end if;
  for n in 1..4 loop insert into public.feature_requests (household_id, created_by, title) values (h1, b, 'Filler ' || n); end loop;
  denied := false; begin insert into public.feature_requests (household_id, created_by, title) values (h1, b, 'One too many'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: request spam not rate-limited'; end if;
  reset role;

  -- ---- admin review
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.feature_requests set status = 'approved', admin_note = 'good one' where id = f1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin could not approve'; end if;
  denied := false; begin update public.feature_requests set status = 'launched' where id = f1; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: invalid status accepted'; end if;
  update public.feature_requests set status = 'building' where id = f1;
  update public.feature_requests set status = 'shipped' where id = f1;
  insert into public.feature_requests (household_id, created_by, title) values (h1, a, 'Admin idea') returning id into f2;
  reset role;

  -- B cannot withdraw a shipped request, but can withdraw a proposed one; cannot touch others'
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.feature_requests where id = f1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: deleted a shipped request'; end if;
  delete from public.feature_requests where id = f2;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: deleted someone else''s request'; end if;
  delete from public.feature_requests where title = 'Filler 1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: could not withdraw own proposal'; end if;
  reset role;

  -- outsider sees and touches nothing
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select (select count(*) from public.feature_requests) + (select count(*) from public.feature_votes) + (select count(*) from public.feature_comments) into n;
  if n <> 0 then raise exception 'FAIL: outsider sees H1 features'; end if;
  denied := false; begin insert into public.feature_votes (request_id, user_id, household_id) values (f1, c, h2); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: outsider voted on H1 request'; end if;
  reset role;

  -- ---- suggested questions
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.suggest_question('short'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: too-short question accepted'; end if;
  denied := false; begin perform public.suggest_question('What is your favorite color today, friend'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: question without the Who''s most likely to prefix accepted'; end if;
  perform public.suggest_question('Who''s most likely to adopt a llama');
  denied := false; begin perform public.suggest_question('who''s most likely to adopt a llama?'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: duplicate suggestion accepted'; end if;
  denied := false; begin perform count(*) from public.card_suggestions; if (select count(*) from public.card_suggestions) <> 1 then denied := true; end if; exception when others then denied := true; end;
  if denied then raise exception 'FAIL: suggester should see exactly their own suggestion'; end if;
  denied := false; begin perform public.review_question((select id from public.card_suggestions limit 1), true); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: member approved a question'; end if;
  reset role;
  select id into s1 from public.card_suggestions limit 1;
  if (select text from public.card_suggestions where id = s1) <> 'Who''s most likely to adopt a llama?' then raise exception 'FAIL: question not normalised with ?'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.card_suggestions;
  if n <> 0 then raise exception 'FAIL: outsider sees H1 suggestions'; end if;
  reset role;

  -- admin approves; the next new day uses it, credited to the suggester
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.review_question(s1, true);
  denied := false; begin perform public.review_question(s1, false); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: question reviewed twice'; end if;
  j := public.card_today();
  if j->>'prompt' <> 'Who''s most likely to adopt a llama?' or j->>'suggested_by' <> 'Bee' then raise exception 'FAIL: approved suggestion not used: %', j; end if;
  if (public.card_today())->>'prompt' <> j->>'prompt' then raise exception 'FAIL: today''s question changed between views'; end if;
  reset role;
  select public.household_today(h1) into today;
  if (select used_on from public.card_suggestions where id = s1) <> today then raise exception 'FAIL: suggestion not marked used'; end if;

  -- history keeps the stored question even if the stock rotation would pick another; today is excluded
  insert into public.card_days (household_id, local_date, prompt) values (h1, yday, 'Who''s most likely to be a stored question?');
  insert into public.card_picks (household_id, local_date, voter_id, pick_id) values (h1, yday, a, b), (h1, yday, b, b);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.card_past(7);
  if jsonb_array_length(j) <> 1 then raise exception 'FAIL: card_past should list the one past day, got %', j; end if;
  if j->0->>'prompt' <> 'Who''s most likely to be a stored question?' then raise exception 'FAIL: past question text changed'; end if;
  if (j->0->>'voted_count')::int <> 2 or j->0->'winners'->>0 <> 'Bee' then raise exception 'FAIL: past result wrong: %', j->0; end if;
  j := public.card_history(7);
  if j->'rounds'->0->>'prompt' <> 'Who''s most likely to be a stored question?' then raise exception 'FAIL: history uses stored question'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
