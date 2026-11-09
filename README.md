# Abingdon Bros

Private PWA for one household of roommates. See [ARCHITECTURE.md](ARCHITECTURE.md) and [TASKS.md](TASKS.md).

Stack: Next.js 16 (App Router) · Tailwind · Supabase (Postgres, Auth, RLS) · Vercel.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in the Supabase URL + publishable (anon) key
pnpm dev                     # http://localhost:3000
```

Generate web-push keys with `npx web-push generate-vapid-keys` and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (the private one is server-only).

`SUPABASE_SERVICE_ROLE_KEY` is server-only and not needed yet. Never expose it to the client.

## Database

Migrations live in `supabase/migrations`. Docker is not required; we work against a hosted project.

```bash
supabase login
supabase link --project-ref <ref>
supabase db push --linked
supabase gen types typescript --linked --schema public > src/lib/database.types.ts
```

## Roommates and login

Login is name + a personal 6-digit code, never shared (no email). Accounts are real Supabase users with a synthetic email
(`<name>@abingdon.example.com`), so RLS applies normally. The roommate list is in `src/lib/roommates.ts`.

```bash
./scripts/seed.sh                          # creates the household + any missing accounts, prints new codes once
RESET_PINS=Jesse ./scripts/seed.sh         # issue a fresh code for one person (signs them out)
```

The script is idempotent. In the Supabase dashboard, turn **off**
"Allow new users to sign up" (Authentication → Sign In / Providers) so nobody can self-register.

## Tests

RLS tests run against the linked database inside a block that always rolls back:

```bash
for f in rls rls_chat rls_daily rls_economy rls_plans rls_profile rls_push rls_cards rls_thursday rls_reminders rls_rally rls_predictions rls_features rls_dm rls_monopoly rls_foundations rls_polish rls_admin rls_pets rls_chess rls_location rls_shop rls_activity; do supabase db query --linked -f supabase/tests/$f.sql; done
```

Passing looks like an error whose message is `ALL RLS TESTS PASSED (rolled back)`.
Any `FAIL:` message is a real failure.

## UI tests (Playwright)

Browser tests run real WebKit (iPhone) and Chromium engines on five screen sizes (iPhone portrait/landscape, small iPhone, Pixel, desktop).
They check every page for overflow, tap-target sizes, controls hidden behind the bottom bar, console errors, missing labels and timings,
and exercise login, status, chat, the admin lock and rotation. They never send chat messages or anything that notifies the house (set `E2E_ALLOW_PUSH=1` to also play a chess move, which pings the opponent).
Login codes come from the environment, never the repo:

```bash
pnpm exec playwright install chromium webkit      # once
set -a && . ./.env.local && set +a
E2E_AYUSH=<admin code> E2E_TYLER=<member code> pnpm exec playwright test --grep-invert @stateful   # parallel
E2E_AYUSH=<admin code> E2E_TYLER=<member code> pnpm exec playwright test --grep @stateful --workers=1  # tests that change shared data, one at a time
# BASE_URL=http://localhost:3000 to test a local build instead of production
```

Screenshots land in `e2e/screens/` and metrics in `e2e/report/` (both git-ignored).

## Scheduled reminders

`pg_cron` runs `enqueue_reminders()` every 5 minutes and, when something is waiting, calls `/api/cron/reminders`
through `pg_net` with a shared secret. The endpoint claims the queued reminders and sends them as web push.
The secret must exist in two places: the `CRON_SECRET` env var (Vercel + `.env.local`) and Supabase Vault as `cron_secret`:

```bash
supabase db query --linked "select vault.create_secret('<same value>', 'cron_secret')"
```

## Admin mode and the feature pipeline

Admins see an **Admin mode** link on Home (`/admin`). The proxy answers 404 for non-admins and every admin page re-checks the role on the server.
Roommates suggest features at `/features` (vote + comment). In admin mode an admin approves/rejects them and moves them through
`approved -> building -> shipped`, and reviews suggested daily-card questions.

Nothing is built automatically. To build approved features, generate a prompt and run it in Claude Code, review the result, then deploy:

```bash
node --no-warnings scripts/feature-prompt.ts          # prints the prompt for approved requests (most-voted first)
claude "$(node --no-warnings scripts/feature-prompt.ts)"
```

The same prompt is available per request (and for all approved at once) in admin mode.

## Deploy

`vercel deploy --prod`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel project.
