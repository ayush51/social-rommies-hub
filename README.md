# Abingdon Bros (Roomies)

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

Login is name + shared 3-digit PIN (no email). Accounts are real Supabase users with a synthetic email
(`<name>@abingdon.example.com`), so RLS applies normally. The roommate list is in `src/lib/roommates.ts`.

```bash
SEED_PIN=<pin> ./scripts/seed.sh   # creates the household + six accounts; re-running resets all to that PIN
```

The script is idempotent. In the Supabase dashboard, turn **off**
"Allow new users to sign up" (Authentication → Sign In / Providers) so nobody can self-register.

## Tests

RLS tests run against the linked database inside a block that always rolls back:

```bash
for f in rls rls_chat rls_daily rls_economy rls_plans rls_profile rls_push rls_cards rls_thursday; do supabase db query --linked -f supabase/tests/$f.sql; done
```

Passing looks like an error whose message is `ALL RLS TESTS PASSED (rolled back)`.
Any `FAIL:` message is a real failure.

## Deploy

`vercel deploy --prod`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel project.
