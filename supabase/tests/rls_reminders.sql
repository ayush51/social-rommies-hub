-- Reminders: who gets queued, dedupe, secret-gated delivery.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); e uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid();
  d1 uuid; p1 uuid; sec text; n int; denied boolean;
  wed timestamptz := '2026-11-04 16:00+00';   -- 2h before the default 18:00 lock
begin
  insert into auth.users (id, email) select u, u || '@test.invalid' from unnest(array[a,b,e]) u;
  insert into public.households (id, name, timezone) values (h1, 'H1', 'UTC');
  insert into public.household_members (household_id, user_id, role) values (h1, a, 'admin'), (h1, b, 'member'), (h1, e, 'member');
  insert into public.dishes (household_id, name) values (h1, 'Tacos') returning id into d1;
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'cron_secret';
  if sec is null then perform vault.create_secret('t3st-secret', 'cron_secret'); sec := 't3st-secret'; end if;

  -- plans: only soon, scheduled, not freshly created, with someone coming
  insert into public.plans (household_id, created_by, title, starts_at, created_at) values (h1, a, 'Taco night', wed + interval '30 minutes', wed - interval '2 hours') returning id into p1;
  insert into public.plans (household_id, created_by, title, starts_at, created_at) values (h1, a, 'Far away', wed + interval '3 hours', wed - interval '2 hours');
  insert into public.plans (household_id, created_by, title, starts_at, status, created_at) values (h1, a, 'Cancelled', wed + interval '20 minutes', 'cancelled', wed - interval '2 hours');
  insert into public.plans (household_id, created_by, title, starts_at, created_at) values (h1, a, 'Just made', wed + interval '20 minutes', wed - interval '1 minute');
  insert into public.plan_rsvps (plan_id, user_id, household_id, response) values (p1, a, h1, 'in'), (p1, b, h1, 'maybe'), (p1, e, h1, 'out');
  perform public.do_vote(a, d1, wed);

  perform public.enqueue_reminders(wed);
  select cardinality(recipients) into n from public.reminder_outbox where kind = 'plan_soon';
  if n is distinct from 2 then raise exception 'FAIL: plan_soon recipients %, expected 2 (in + maybe)', n; end if;
  select count(*) into n from public.reminder_outbox where kind = 'plan_soon';
  if n <> 1 then raise exception 'FAIL: % plan reminders (far/cancelled/new plans must not fire)', n; end if;
  select cardinality(recipients) into n from public.reminder_outbox where kind = 'poll_closing';
  if n is distinct from 2 then raise exception 'FAIL: poll_closing should go to the 2 non-voters, got %', n; end if;
  if public.enqueue_reminders(wed) <> 0 then raise exception 'FAIL: second run queued duplicates'; end if;

  -- winner reveal at lock, Thursday-morning nudge only from 09:00 local
  if public.enqueue_reminders('2026-11-04 19:00+00') <> 1 then raise exception 'FAIL: winner reveal not queued once'; end if;
  if (select body from public.reminder_outbox where kind = 'poll_winner') <> 'Jay is making Tacos' then raise exception 'FAIL: winner text'; end if;
  if public.enqueue_reminders('2026-11-05 08:00+00') <> 0 then raise exception 'FAIL: Thursday nudge fired before 09:00'; end if;
  if public.enqueue_reminders('2026-11-05 09:30+00') <> 1 then raise exception 'FAIL: Thursday 09:30 nudge not queued'; end if;
  if public.enqueue_reminders('2026-11-05 22:00+00') <> 0 then raise exception 'FAIL: nudge re-queued'; end if;

  -- delivery: devices only for recipients, secret required, at-most-once
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth)
    values (a, h1, 'ep-a', 'k', 'a'), (b, h1, 'ep-b1', 'k', 'a'), (b, h1, 'ep-b2', 'k', 'a');
  denied := false; begin perform public.reminders_claim('wrong'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: claim accepted a wrong secret'; end if;
  denied := false; begin perform public.reminders_claim(null); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: claim accepted a null secret'; end if;
  select count(*) into n from public.reminders_claim(sec);
  if n <> 11 then raise exception 'FAIL: expected 11 device deliveries, got %', n; end if;
  select count(*) into n from public.reminders_claim(sec);
  if n <> 0 then raise exception 'FAIL: reminders delivered twice'; end if;
  perform public.reminders_drop(sec, array['ep-b1']);
  select count(*) into n from public.push_subscriptions where endpoint = 'ep-b1';
  if n <> 0 then raise exception 'FAIL: dead endpoint not dropped'; end if;

  -- clients cannot touch any of it
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  denied := false; begin perform public.enqueue_reminders(); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: clients can enqueue reminders'; end if;
  denied := false; begin perform count(*) from public.reminder_outbox; exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: outbox readable by clients'; end if;
  denied := false; begin perform public.reminders_claim('guess'); exception when others then denied := true; end;
  if not denied then raise exception 'FAIL: clients can claim without the secret'; end if;
  reset role;

  raise exception 'ALL RLS TESTS PASSED (rolled back)';
end $$;
