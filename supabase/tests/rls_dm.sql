-- DMs, chat photos, replies: privacy of messages, reactions, images and pushes.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); e uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid();
  g1 uuid; dm1 uuid; dm2 uuid; gimg uuid; n int; denied boolean; imgpath text;
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,e,c]) u;
  insert into public.households (id, name) values (h1, 'H1'), (h2, 'H2');
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h1, e, 'member'), (h2, c, 'admin');
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth)
    values (a, h1, 'ep-a', 'k', 'a'), (b, h1, 'ep-b', 'k', 'a'), (e, h1, 'ep-e', 'k', 'a');

  -- A posts to the group and DMs B
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages (household_id, user_id, body) values (h1, a, 'hello house') returning id into g1;
  insert into public.messages (household_id, user_id, recipient_id, body) values (h1, a, b, 'psst, just you') returning id into dm1;
  denied := false; begin insert into public.messages (household_id, user_id, recipient_id, body) values (h1, a, a, 'to myself'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: DM to self accepted'; end if;
  denied := false; begin insert into public.messages (household_id, user_id, recipient_id, body) values (h1, a, c, 'to outsider'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: DM to someone outside the household accepted'; end if;
  denied := false; begin insert into public.messages (household_id, user_id, recipient_id, body) values (h1, b, e, 'spoofed sender'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: sent a DM as someone else'; end if;
  denied := false; begin insert into public.messages (household_id, user_id, body) values (h1, a, ''); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: empty message accepted'; end if;
  insert into public.messages (household_id, user_id, body, image_path) values (h1, a, '', h1 || '/' || a || '/group.jpg') returning id into gimg;
  insert into public.messages (household_id, user_id, recipient_id, body, image_path) values (h1, a, b, '', h1 || '/' || a || '/secret.jpg') returning id into dm2;
  insert into public.messages (household_id, user_id, body, reply_to) values (h1, a, 'replying to myself', g1);
  insert into storage.objects (bucket_id, name) values ('chat', h1 || '/' || a || '/group.jpg'), ('chat', h1 || '/' || a || '/secret.jpg');
  denied := false; begin insert into storage.objects (bucket_id, name) values ('chat', h1 || '/' || b || '/theirs.jpg'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: uploaded into another user''s chat folder'; end if;
  insert into public.message_reactions (message_id, user_id, household_id, emoji) values (dm1, a, h1, 'x');
  reset role;

  -- B (recipient) sees group + both DMs; third housemate E sees only the group
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.messages;
  if n <> 5 then raise exception 'FAIL: recipient sees % messages, expected 5', n; end if;
  select count(*) into n from storage.objects where bucket_id = 'chat';
  if n <> 2 then raise exception 'FAIL: recipient sees % chat images, expected 2', n; end if;
  insert into public.message_reactions (message_id, user_id, household_id, emoji) values (dm1, b, h1, 'y');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.messages where recipient_id is not null;
  if n <> 0 then raise exception 'FAIL: bystander sees % DMs', n; end if;
  select count(*) into n from public.messages;
  if n <> 3 then raise exception 'FAIL: bystander sees % messages, expected the 3 group ones', n; end if;
  select count(*) into n from public.message_reactions;
  if n <> 0 then raise exception 'FAIL: bystander sees reactions on a DM'; end if;
  denied := false; begin insert into public.message_reactions (message_id, user_id, household_id, emoji) values (dm1, e, h1, 'z'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: bystander reacted to a DM'; end if;
  select count(*) into n from storage.objects where bucket_id = 'chat' and name like '%secret.jpg';
  if n <> 0 then raise exception 'FAIL: bystander can see a DM photo'; end if;
  select count(*) into n from storage.objects where bucket_id = 'chat' and name like '%group.jpg';
  if n <> 1 then raise exception 'FAIL: housemate cannot see the group photo'; end if;
  delete from public.messages where id = dm1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: bystander deleted a DM'; end if;
  reset role;

  -- admin A2 cannot moderate DMs: make E an admin to test
  update public.household_members set role = 'admin' where user_id = e;
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.messages where id = dm2;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: admin deleted someone''s DM'; end if;
  delete from public.messages where id = g1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: admin could not moderate group chat'; end if;
  reset role;
  update public.household_members set role = 'member' where user_id = e;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.messages;
  if n <> 0 then raise exception 'FAIL: outsider sees H1 messages'; end if;
  reset role;

  -- push: a DM notifies only the recipient; the group notifies everyone else
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.push_targets('message', dm2);
  if n <> 1 then raise exception 'FAIL: DM push should reach exactly the recipient, got %', n; end if;
  select count(*) into n from public.push_targets('message', gimg);
  if n <> 2 then raise exception 'FAIL: group push should reach the 2 housemates, got %', n; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
