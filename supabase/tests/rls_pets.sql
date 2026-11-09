-- Pets: admin-only management, decay math, feed/treat limits, rewards, wallet safety, reminders, storage.
create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function pg_temp.as_su() returns void language plpgsql as $$
begin reset role; end $$;
-- true when the statement raises
create function pg_temp.fails(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return true; end $$;
-- true when the statement raises or touches no rows
create function pg_temp.zero(q text) returns boolean language plpgsql as $$
declare n int;
begin execute q; get diagnostics n = row_count; return n = 0; exception when others then return true; end $$;

do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); e uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  p uuid; p2 uuid; j jsonb; n int; v int; r record; k1 uuid := gen_random_uuid(); k2 uuid := gen_random_uuid(); k3 uuid := gen_random_uuid();
  w record; bal0 bigint;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,c,e,d]) u;
  insert into public.households (id, name, timezone, starting_balance) values (h1, 'H1', 'UTC', 10), (h2, 'H2', 'UTC', 10);
  insert into public.household_members (household_id, user_id, role)
    values (h1, a, 'admin'), (h1, b, 'member'), (h1, c, 'member'), (h1, e, 'member'), (h2, d, 'admin');
  perform public.ensure_wallet(e, h1);
  perform public.post_ledger(e, h1, -8, 'adjustment', 'test-drain:' || e);   -- e has 2 bingdons

  -- ================= admin only =================
  perform pg_temp.as_user(b);
  if not pg_temp.fails(format('select public.pets_create(%L, %L, %L)', 'Mae', 'cat', 'hi')) then raise exception 'FAIL: member created a pet'; end if;
  if not pg_temp.fails(format('insert into public.pets (household_id, name, created_by) values (%L, %L, %L)', h1, 'X', b)) then raise exception 'FAIL: direct pet insert'; end if;
  perform pg_temp.as_user(a);
  if not pg_temp.fails(format('select public.pets_create(%L, %L, %L)', '', 'cat', '')) then raise exception 'FAIL: empty name accepted'; end if;
  if not pg_temp.fails(format('select public.pets_create(%L, %L, %L)', repeat('x', 41), 'cat', '')) then raise exception 'FAIL: long name accepted'; end if;
  if not pg_temp.fails(format('select public.pets_create(%L, %L, %L)', 'Mae', 'cat', repeat('x', 301))) then raise exception 'FAIL: long bio accepted'; end if;
  p := public.pets_create('Mae', 'cat', 'Chief of naps');
  p2 := public.pets_create('Rex', 'dog', '');
  if not pg_temp.fails(format('select public.pets_update(%L, %L, %L, %L, %L, %L)', p, 'Mae', 'cat', '', h2 || '/' || p || '/x.png', true)) then raise exception 'FAIL: foreign photo path accepted'; end if;
  perform public.pets_update(p, 'Mae B', 'cat', 'Naps', h1 || '/' || p || '/x.png', true);
  if (select name || photo_path from public.pets where id = p) <> 'Mae B' || h1 || '/' || p || '/x.png' then raise exception 'FAIL: update not applied'; end if;
  perform public.pets_update(p, 'Mae', 'cat', 'Naps', null, true);
  if (select photo_path from public.pets where id = p) is null then raise exception 'FAIL: null photo should keep it'; end if;
  perform public.pets_update(p, 'Mae', 'cat', 'Naps', '', true);
  if (select photo_path from public.pets where id = p) is not null then raise exception 'FAIL: empty photo should clear it'; end if;

  perform pg_temp.as_user(b);
  if not pg_temp.fails(format('select public.pets_update(%L, %L, %L, %L, null, true)', p, 'Hax', 'cat', '')) then raise exception 'FAIL: member edited a pet'; end if;
  select count(*) into n from public.pets;
  if n <> 2 then raise exception 'FAIL: member should read pets, saw %', n; end if;
  select count(*) into n from public.pets_overview();
  if n <> 2 then raise exception 'FAIL: overview count %', n; end if;
  if not pg_temp.zero(format('update public.pets set name = %L', 'Hax')) then raise exception 'FAIL: direct pet update'; end if;
  if not pg_temp.zero('update public.pet_state set hunger = 0') then raise exception 'FAIL: direct state update'; end if;
  if not pg_temp.fails(format('insert into public.pet_actions (pet_id, user_id, household_id, kind, local_date) values (%L, %L, %L, %L, current_date)', p, b, h1, 'feed')) then raise exception 'FAIL: direct action insert'; end if;
  if not pg_temp.zero('delete from public.pets') then raise exception 'FAIL: direct pet delete'; end if;
  if not pg_temp.fails('select public.pets_state_at(null)') then raise exception 'FAIL: internal decay callable'; end if;
  if not pg_temp.fails('select public.enqueue_pets_reminders()') then raise exception 'FAIL: reminders callable by clients'; end if;
  if not pg_temp.fails('select public.pets_enqueue_reminders_at(now())') then raise exception 'FAIL: clocked reminders callable by clients'; end if;
  if not pg_temp.fails('select * from public.reminder_outbox') then raise exception 'FAIL: outbox readable'; end if;

  perform pg_temp.as_user(d);
  select count(*) into n from public.pets;
  if n <> 0 then raise exception 'FAIL: outsider sees pets'; end if;
  select count(*) into n from public.pets_overview();
  if n <> 0 then raise exception 'FAIL: outsider overview'; end if;
  if not pg_temp.fails(format('select public.pets_feed(%L)', p)) then raise exception 'FAIL: outsider fed'; end if;
  if not pg_temp.fails(format('select public.pets_treat(%L, gen_random_uuid())', p)) then raise exception 'FAIL: outsider treated'; end if;
  if not pg_temp.fails(format('select * from public.pets_recent(%L)', p)) then raise exception 'FAIL: outsider read activity'; end if;
  if not pg_temp.fails(format('select public.pets_update(%L, %L, %L, %L, null, true)', p, 'Hax', 'cat', '')) then raise exception 'FAIL: foreign admin edited a pet'; end if;
  select count(*) into n from public.pet_actions;
  if n <> 0 then raise exception 'FAIL: outsider sees actions'; end if;

  -- ================= decay math =================
  perform pg_temp.as_su();
  select * into r from public.pets_state_at(p);
  if r.hunger <> 30 or r.happiness <> 70 then raise exception 'FAIL: initial state % %', r.hunger, r.happiness; end if;
  select * into r from public.pets_state_at(p, now() + interval '10 hours');
  if r.hunger <> 60 or r.happiness <> 50 then raise exception 'FAIL: 10h decay % %', r.hunger, r.happiness; end if;
  select * into r from public.pets_state_at(p, now() + interval '90 minutes');
  if r.hunger <> 34 or r.happiness <> 67 then raise exception 'FAIL: 1.5h decay % %', r.hunger, r.happiness; end if;
  select * into r from public.pets_state_at(p, now() + interval '30 hours');
  if r.hunger <> 100 or r.happiness <> 10 then raise exception 'FAIL: 30h decay % %', r.hunger, r.happiness; end if;
  select * into r from public.pets_state_at(p, now() + interval '100 hours');
  if r.hunger <> 100 or r.happiness <> 0 then raise exception 'FAIL: clamp % %', r.hunger, r.happiness; end if;
  select * into r from public.pets_state_at(p, now() - interval '5 hours');
  if r.hunger <> 30 or r.happiness <> 70 then raise exception 'FAIL: past clock should not decay'; end if;
  update public.pet_state set updated_at = now() - interval '10 hours' where pet_id = p;
  perform pg_temp.as_user(b);
  select * into r from public.pets_overview(p);
  if r.hunger <> 60 or r.happiness <> 50 or r.feeds_left <> 2 or r.treats_left <> 3 or r.last_fed_by is not null then raise exception 'FAIL: overview decay/limits'; end if;
  perform pg_temp.as_su();
  update public.pet_state set hunger = 20, happiness = 70, updated_at = now() where pet_id = p;

  -- ================= feeding =================
  perform pg_temp.as_user(b);
  j := public.pets_feed(p);                                           -- hunger 20: no reward, floor at 0
  if (j->>'hunger')::int <> 0 or (j->>'reward')::int <> 0 or (j->>'feeds_left')::int <> 1 then raise exception 'FAIL: first feed %', j; end if;
  perform pg_temp.as_su();
  update public.pet_state set hunger = 60 where pet_id = p;
  perform pg_temp.as_user(b);
  j := public.pets_feed(p);                                           -- hunger 60: +2 bingdons, -40
  if (j->>'hunger')::int <> 20 or (j->>'reward')::int <> 2 or (j->>'feeds_left')::int <> 0 then raise exception 'FAIL: second feed %', j; end if;
  if (select balance from public.wallets where user_id = b) <> 12 then raise exception 'FAIL: reward not paid'; end if;
  if not pg_temp.fails(format('select public.pets_feed(%L)', p)) then raise exception 'FAIL: third feed allowed'; end if;
  select * into r from public.pets_overview(p);
  if r.last_fed_by is null or r.feeds_left <> 0 then raise exception 'FAIL: last fed not recorded'; end if;

  perform pg_temp.as_su();
  update public.pet_state set hunger = 50 where pet_id = p;
  perform pg_temp.as_user(c);
  j := public.pets_feed(p);                                           -- exactly 50 still earns
  if (j->>'reward')::int <> 2 or (j->>'hunger')::int <> 10 then raise exception 'FAIL: c first feed %', j; end if;
  perform pg_temp.as_su();
  update public.pet_state set hunger = 90 where pet_id = p;
  perform pg_temp.as_user(c);
  j := public.pets_feed(p);                                           -- second hungry feed same day: no second reward
  if (j->>'reward')::int <> 0 then raise exception 'FAIL: reward paid twice in a day'; end if;
  if (select balance from public.wallets where user_id = c) <> 12 then raise exception 'FAIL: c balance'; end if;
  select count(*) into n from public.ledger_entries where user_id = c and kind = 'pet_reward';
  if n <> 1 then raise exception 'FAIL: reward ledger rows %', n; end if;

  perform pg_temp.as_su();
  update public.pet_state set hunger = 100 where pet_id = p;
  perform pg_temp.as_user(e);
  j := public.pets_feed(p);                                           -- e feeds the other pet's cap separately
  if (j->>'hunger')::int <> 60 then raise exception 'FAIL: 100 - 40'; end if;
  j := public.pets_feed(p2);
  if (j->>'feeds_left')::int <> 1 then raise exception 'FAIL: caps are per pet'; end if;

  -- another day: counts reset (shift the stored dates back)
  perform pg_temp.as_su();
  update public.pet_actions set local_date = local_date - 1 where user_id = b;
  update public.pet_state set hunger = 70 where pet_id = p;
  perform pg_temp.as_user(b);
  select * into r from public.pets_overview(p);
  if r.feeds_left <> 2 then raise exception 'FAIL: cap did not reset next day'; end if;
  j := public.pets_feed(p);
  if (j->>'hunger')::int <> 30 then raise exception 'FAIL: next-day feed'; end if;

  -- ================= treats =================
  perform pg_temp.as_user(b);
  select balance into bal0 from public.wallets where user_id = b;
  perform pg_temp.as_su();
  update public.pet_state set happiness = 40, updated_at = now() where pet_id = p;
  perform pg_temp.as_user(b);
  j := public.pets_treat(p, k1);
  if (j->>'happiness')::int <> 55 or (j->>'treats_left')::int <> 2 or (j->>'replay')::boolean then raise exception 'FAIL: treat %', j; end if;
  if (select balance from public.wallets where user_id = b) <> bal0 - 3 then raise exception 'FAIL: treat cost'; end if;
  j := public.pets_treat(p, k1);                                      -- replay of the same tap
  if not (j->>'replay')::boolean or (j->>'treats_left')::int <> 2 then raise exception 'FAIL: replay %', j; end if;
  if (select balance from public.wallets where user_id = b) <> bal0 - 3 then raise exception 'FAIL: replay charged twice'; end if;
  perform public.pets_treat(p, k2);
  perform public.pets_treat(p, k3);
  if not pg_temp.fails(format('select public.pets_treat(%L, gen_random_uuid())', p)) then raise exception 'FAIL: fourth treat allowed'; end if;
  if (select balance from public.wallets where user_id = b) <> bal0 - 9 then raise exception 'FAIL: three treats cost 9'; end if;
  if not pg_temp.fails(format('select public.pets_treat(%L, null)', p)) then raise exception 'FAIL: null key accepted'; end if;

  perform pg_temp.as_su();
  update public.pet_state set happiness = 95 where pet_id = p;
  perform pg_temp.as_user(c);
  j := public.pets_treat(p, gen_random_uuid());
  if (j->>'happiness')::int <> 100 then raise exception 'FAIL: happiness cap'; end if;

  perform pg_temp.as_su();
  perform public.post_ledger(e, h1, -3, 'adjustment', 'test-drain2:' || e);   -- e (feeding reward included) now has 1
  perform pg_temp.as_user(e);
  if not pg_temp.fails(format('select public.pets_treat(%L, gen_random_uuid())', p)) then raise exception 'FAIL: treat with insufficient balance'; end if;
  if (select balance from public.wallets where user_id = e) <> 1 then raise exception 'FAIL: e charged'; end if;
  select count(*) into n from public.pet_actions where user_id = e and kind = 'treat';
  if n <> 0 then raise exception 'FAIL: failed treat left an action'; end if;

  -- ================= activity =================
  perform pg_temp.as_user(b);
  select count(*) into n from public.pets_recent(p, 100);
  if n < 5 then raise exception 'FAIL: activity list %', n; end if;
  select count(*) into n from public.pets_recent(p, 2);
  if n <> 2 then raise exception 'FAIL: activity limit'; end if;

  -- ================= deactivate =================
  perform pg_temp.as_user(a);
  perform public.pets_update(p2, 'Rex', 'dog', '', null, false);
  select count(*) into n from public.pets_overview();
  if n <> 1 then raise exception 'FAIL: inactive pet listed for admin by default'; end if;
  select count(*) into n from public.pets_overview(null, true);
  if n <> 2 then raise exception 'FAIL: admin cannot list inactive'; end if;
  perform pg_temp.as_user(b);
  select count(*) into n from public.pets_overview(null, true);
  if n <> 1 then raise exception 'FAIL: member listed inactive pets'; end if;
  if not pg_temp.fails(format('select public.pets_feed(%L)', p2)) then raise exception 'FAIL: fed an inactive pet'; end if;

  -- ================= reminders =================
  perform pg_temp.as_su();
  update public.pet_state set hunger = 79, updated_at = now() where pet_id = p;
  if public.pets_enqueue_reminders_at(now()) <> 0 then raise exception 'FAIL: reminder at hunger 79'; end if;
  update public.pet_state set hunger = 80 where pet_id = p;
  if public.pets_enqueue_reminders_at(now()) <> 1 then raise exception 'FAIL: reminder at hunger 80 (inactive pet must be skipped)'; end if;
  if public.pets_enqueue_reminders_at(now()) <> 0 then raise exception 'FAIL: reminder repeated within 12h'; end if;
  if public.enqueue_pets_reminders() <> 0 then raise exception 'FAIL: zero-arg wrapper repeated'; end if;
  select cardinality(recipients) into n from public.reminder_outbox where kind = 'pet_hungry' and household_id = h1;
  if n <> 4 then raise exception 'FAIL: reminder recipients %', n; end if;
  if public.pets_enqueue_reminders_at(now() + interval '12 hours 1 second') <> 1 then raise exception 'FAIL: reminder after 12h'; end if;
  select count(*) into n from public.reminder_outbox where kind = 'pet_hungry' and ref like p || ':%';
  if n <> 2 then raise exception 'FAIL: reminder rows %', n; end if;
  if not exists (select 1 from pg_proc where proname = 'enqueue_pets_reminders' and pronargs = 0 and prorettype = 'integer'::regtype) then
    raise exception 'FAIL: dispatcher cannot discover the reminder function';
  end if;

  -- ================= storage =================
  perform pg_temp.as_user(a);
  insert into storage.objects (bucket_id, name) values ('pets', h1 || '/' || p || '/mae.png');
  perform pg_temp.as_user(b);
  if not pg_temp.fails(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'pets', h1 || '/' || p || '/b.png')) then raise exception 'FAIL: member uploaded'; end if;
  select count(*) into n from storage.objects where bucket_id = 'pets';
  if n <> 1 then raise exception 'FAIL: member should read pet photos'; end if;
  if not pg_temp.zero('delete from storage.objects where bucket_id = ''pets''') then raise exception 'FAIL: member deleted a photo'; end if;
  perform pg_temp.as_user(d);
  if not pg_temp.fails(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'pets', h1 || '/' || p || '/d.png')) then raise exception 'FAIL: foreign admin uploaded'; end if;
  select count(*) into n from storage.objects where bucket_id = 'pets';
  if n <> 0 then raise exception 'FAIL: outsider reads pet photos'; end if;
  if not pg_temp.zero('delete from storage.objects where bucket_id = ''pets''') then raise exception 'FAIL: outsider deleted a photo'; end if;
  perform pg_temp.as_user(a);
  -- SQL deletes on storage.objects are blocked by Supabase itself; the delete policy is checked by name
  perform pg_temp.as_su();
  if (select count(*) from pg_policies where schemaname = 'storage' and policyname in ('pets: admins delete', 'pets: admins upload', 'pets: members read')) <> 3 then
    raise exception 'FAIL: storage policies missing';
  end if;

  -- ================= conservation =================
  perform pg_temp.as_su();
  for w in select wl.user_id, wl.balance, (select coalesce(sum(amount), 0) from public.ledger_entries l where l.user_id = wl.user_id) s
           from public.wallets wl where wl.household_id = h1 loop
    if w.balance <> w.s then raise exception 'FAIL: wallet % != ledger %', w.balance, w.s; end if;
    if w.balance < 0 then raise exception 'FAIL: negative wallet'; end if;
  end loop;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
