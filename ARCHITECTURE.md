# Roomies — Architecture

Private, invite-only social app for one household of roommates. Mobile-first PWA.

## Stack
Next.js (App Router, TypeScript) · Tailwind + shadcn/ui · Supabase (Postgres, Auth, Realtime, Storage) · Vercel hosting + Vercel Cron.

## Tenancy and security
- Every domain table has `household_id`. Cross-household access is impossible by RLS, not by app code.
- RLS helpers (security definer, `search_path` pinned):
  - `is_household_member(hid)` — caller is an active member
  - `is_household_admin(hid)` — caller has role `admin`
- Roles live in `household_members.role` (`member` | `admin`). `/admin` checks the role server-side on every request; the UI hiding links is cosmetic.
- Clients use the anon key + user JWT only. The service-role key exists only in server-only modules (`src/lib/supabase/admin.ts`, `import "server-only"`) used by cron routes and invite redemption.
- Privileged or multi-step writes (join via invite, ledger moves, settlement, game moves) are Postgres functions (RPC) or server actions that validate input with zod. Tables that must not be client-writable get no insert/update policy.
- Rate limits: a `rate_limit_hit(key, window, max)` Postgres function called from RPCs/server actions for chat, economy and game actions (added in the phase that introduces each).

## Economy (Phase 3)
- Append-only `ledger_entries(id, household_id, user_id, amount, reason, idempotency_key unique, created_at)`; no update/delete policies or grants.
- Balance = materialised `wallets.balance` updated in the same transaction as the ledger insert, under `SELECT … FOR UPDATE`, with `CHECK (balance >= 0)`.
- Rewards and daily claims use deterministic idempotency keys (e.g. `daily:{user}:{local_date}`), so retries and replays are no-ops.
- bingdons have no cash value: no deposit, withdrawal or redemption paths exist.

## Time
Household has an IANA `timezone` and `daily_reset_time`. Scheduled jobs compute the household-local date in SQL and write rows keyed by `(household_id, local_date)` with unique constraints, so re-running a job is idempotent. Photo expiry is enforced in the backend: the feed RPC/RLS filters on `local_date = household_today()`; the UI never decides.

## Photos (Phase 4, policy decided now)
Private bucket, signed URLs only. At expiry a photo leaves the daily feed but is **archived** (kept, visible to its owner and in a household "memories" view); deletion happens only when the owner or an admin deletes it, or the user leaves the household (purged).

## Realtime
Supabase Realtime on `messages`, statuses, reactions; subscriptions are RLS-filtered, so members only receive their household's rows.

## Layout
```
src/app/(auth)/        login, join
src/app/(app)/         home, daily, plans, games, chat (+ pets, wallet, …)
src/app/admin/         admin dashboard (role-gated)
src/lib/supabase/      browser / server / admin clients
src/lib/               zod schemas, services
supabase/migrations/   SQL migrations (RLS included)
supabase/tests/        pgTAP RLS tests
supabase/seed.sql      fictional household
```

## Schema roadmap
Phase 1: `households`, `profiles`, `household_members`, `invites`. Each later phase adds only its own tables (statuses, messages, wallets/ledger, daily_posts, plans, pets, markets, games, polls, locations, feature_requests, audit/error logs).

## Navigation
Bottom nav: Home · Daily · Plans · Games · Chat. Secondary (menu on Home/Profile): Pets, Wallet, Predictions, Location, Feature Requests, Profile, Settings. `/admin` separate.

## Dev environment note
Local Supabase needs Docker, which is not installed on this machine. Install Docker Desktop (or OrbStack) before `supabase start`, or point `.env.local` at a hosted project.
