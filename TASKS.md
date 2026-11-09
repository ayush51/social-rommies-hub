# Abingdon Bros — Tasks

Each phase is independently testable and ships only the tables it needs. `[x]` done, `[ ]` not started.

## Shipped
- [x] **0. Docs** — ARCHITECTURE.md, TASKS.md, README
- [x] **1. Foundation** — Next.js 16, hosted Supabase, name + PIN login for six roommates, households / profiles / members, RLS + rollback tests, app shell + bottom nav, seed script
- [x] **2a. Status** — presets + custom, optional expiry, live roster
- [x] **2b. Chat** — realtime, emoji reactions, delete (own / admin), rate limit
- [x] **3a. Economy core (bingdons)** — wallets, append-only ledger, idempotency keys, no negative balance, welcome bonus, daily reward, history, leaderboard
- [x] **4a. Daily photos** — camera + library, optional selfie, private storage + signed URLs, reactions, comments, tips, backend-enforced expiry, Memories archive
- [x] **5a. Plans** — create/edit, cancel/restore, in/maybe/out, participant lists, comments
- [x] **Profiles** — avatar, nickname, birthday, last seen
- [x] **Push notifications** — installable PWA, bell (top right), messages / rallies / plans / daily photos
- [x] **8a. Daily card** — "who's most likely to…": pick one of the six roommates, counts shown after you vote, 5 bingdons for voting, most-voted leaderboard + history on Games
- [x] **9a. Thirsty Thursdays** — weekly poll (Tue open, configurable lock, default Wed 6 p.m.), admin dishes + cook + lock settings, 5 coins for voting, winner banner + confetti
- [x] **Scheduled reminders** — pg_cron every 5 min: plan starting within the hour, poll closing (non-voters), winner reveal at lock, Thursday 9 a.m. nudge; once each, via push
- [x] **9c. Feature requests** — propose / vote / comment, admin mode review (proposed → approved → building → shipped / rejected), Claude Code prompt generator + `scripts/feature-prompt.ts`
- [x] **Suggested daily-card questions** — Home-only form, admin approval, approved ones used first and credited; each day's question is stored; past questions on Home
- [x] **Predictions** — hosted markets with a resolver, bets in bingdons, exact payouts, refunds, resolver reminder
- [x] **Chat upgrades** — DMs (private incl. photos + reactions), 8-emoji picker with who-reacted, replies, photos from camera/library
- [x] **8c. Abingdon Street (Monopoly-style)** — turn-based, 2-6 players, bingdon buy-in + pot, server-rolled dice, rent/sets/upgrades/jail/cards/bankruptcy, push on your turn, idle skip
- [x] **UI test suite** (Playwright, 5 screen sizes) + error/404 screens
- [x] **Rally** — separate Home section, posts "who's in?" to chat

## Pending features (from the original spec)
- [ ] **Economy extras** — purchases with coins, poll/activity rewards, admin-configurable reward amounts
- [ ] **Home activity feed** — recent happenings (posts, plans, tips, wins)
- [ ] **6. Pets** — admin uploads pets, profiles, feed/treat with daily limits, hunger/happiness
- [ ] **7. Predictions** — friendly markets, stake bingdons, server settlement, creator/admin resolves
- [ ] **8b. Chess** (multiplayer)
- [ ] **9b. Location** — opt-in, approximate or precise, off by default, pause + auto-expiry, visible indicator
- [ ] **10. Admin dashboard** — admin mode exists (features, questions). Still to add: roommates, pets, rewards, polls, moderation, logs, timezone + reset time

## Hardening / loose ends
- [ ] Turn off public sign-ups in Supabase (dashboard setting, user action)
- [x] Personal 6-digit login codes (shared PIN retired after it was abused)
- [ ] Change-your-own-code screen
- [ ] Set the real household timezone (placeholder is America/New_York)
- [ ] Error boundaries, loading + empty states audit
- [ ] Drop the unused invites table / functions
- [ ] Polish: animations, confetti, dark/light toggle
