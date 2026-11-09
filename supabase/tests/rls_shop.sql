-- Shop: purchases, idempotency, effects, question pass, no self-granted perks.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  k uuid := gen_random_uuid(); n int; denied boolean; bal bigint; w record; st text;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c]) u;
  insert into public.households (id, name, timezone, starting_balance) values (h1, 'H1', 'UTC', 500), (h2, 'H2', 'UTC', 500);
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h2, c, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.shop_buy('spotlight', k);
  perform public.shop_buy('spotlight', k);                 -- replay: no second charge
  select count(*) into n from public.shop_purchases where item_code = 'spotlight';
  if n <> 1 then raise exception 'FAIL: replay created % purchases', n; end if;
  if (select spotlight_until from public.profiles where id = b) < now() + interval '23 hours' then raise exception 'FAIL: spotlight not set for ~24h'; end if;
  denied := false; begin perform public.shop_buy('nonsense', gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: unknown item bought'; end if;
  perform public.shop_buy('badge_star', gen_random_uuid());
  if (select badge from public.profiles where id = b) <> 'star' then raise exception 'FAIL: star badge not applied'; end if;
  denied := false; begin perform public.shop_buy('badge_star', gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: bought the same badge twice'; end if;
  denied := false; begin perform public.shop_buy('badge_crown', gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: crown should be unaffordable with 310 left'; end if;
  reset role;
  select balance into bal from public.wallets where user_id = b;
  if bal <> 500 - 40 - 150 then raise exception 'FAIL: B balance % expected 310 (failed buy must not charge)', bal; end if;

  -- a question pass skips review exactly once
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.shop_buy('question_pass', gen_random_uuid());
  perform public.suggest_question('Who''s most likely to adopt twelve cats');
  perform public.suggest_question('Who''s most likely to learn the bagpipes');
  reset role;
  select status into st from public.card_suggestions where text like '%twelve cats%';
  if st <> 'approved' then raise exception 'FAIL: pass should auto-approve the first question, got %', st; end if;
  select status into st from public.card_suggestions where text like '%bagpipes%';
  if st <> 'pending' then raise exception 'FAIL: pass is single use, second should be pending, got %', st; end if;
  if (select used_at from public.shop_purchases where item_code = 'question_pass') is null then raise exception 'FAIL: pass not consumed'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.suggest_question('Who''s most likely to win a hot dog contest');
  reset role;
  select status into st from public.card_suggestions where text like '%hot dog%';
  if st <> 'pending' then raise exception 'FAIL: someone without a pass must stay pending'; end if;

  -- no self-granted perks, no direct writes
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin update public.profiles set badge = 'crown' where id = a; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: set own badge directly'; end if;
  denied := false; begin update public.profiles set spotlight_until = now() + interval '30 days' where id = a; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: set own spotlight directly'; end if;
  update public.profiles set nickname = 'Ace' where id = a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: could no longer edit own nickname'; end if;
  denied := false; begin insert into public.shop_purchases (user_id, household_id, item_code) values (a, h1, 'badge_crown'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: direct purchase insert allowed'; end if;
  select count(*) into n from public.shop_items;
  if n <> 4 then raise exception 'FAIL: shop items not readable'; end if;
  select count(*) into n from public.shop_purchases;
  if n <> 0 then raise exception 'FAIL: A sees someone else''s purchases'; end if;
  reset role;

  -- A can afford the crown (500 >= 400), then not the star
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.shop_buy('badge_crown', gen_random_uuid());
  denied := false; begin perform public.shop_buy('badge_star', gen_random_uuid()); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: 100 bingdons should not buy a 150 star'; end if;
  reset role;
  if (select badge from public.profiles where id = a) <> 'crown' then raise exception 'FAIL: crown not applied'; end if;

  -- outsider isolation
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.shop_purchases;
  if n <> 0 then raise exception 'FAIL: outsider sees purchases'; end if;
  reset role;

  for w in select wl.user_id, wl.balance, (select coalesce(sum(amount), 0) from public.ledger_entries l where l.user_id = wl.user_id) s
           from public.wallets wl where wl.household_id = h1 loop
    if w.balance <> w.s then raise exception 'FAIL: wallet % != ledger %', w.balance, w.s; end if;
  end loop;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
