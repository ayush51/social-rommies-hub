# Roomies — Tasks

Each phase is independently testable and ships only the tables it needs.

- [ ] **0. Docs** — ARCHITECTURE.md, TASKS.md
- [x] **1. Foundation** — Next.js app, hosted Supabase, PIN login for six roommates, households / profiles / members / invites, RLS + tests, app shell + bottom nav, seed, README
- [~] **2. Home, status, chat** — done: statuses (expiry), realtime chat (reactions, delete, rate limit). rally (post to chat + one-tap join). Todo: chat photos, notifications
- [~] **3. Economy (Abby Coins)** — done: wallets, append-only ledger, welcome bonus, daily reward, photo tips, history, leaderboard, tests. Todo: game/poll rewards, purchases, admin reward config
- [~] **4. Daily photos** — done: camera/library capture, selfie, private storage + signed URLs, reactions/comments, RLS expiry, Memories archive (no cron needed). tips
- [~] **5. Plans** — done: create/edit, cancel/restore, in/maybe/out RSVPs, participant lists, comments, Home "Coming up". Todo: reminders (needs notifications)
- [ ] **6. Pets** — admin-managed pets, feed/treat limits, hunger/happiness
- [ ] **7. Predictions** — markets, stakes, server settlement, resolution
- [ ] **8. Games** — daily card prompt, chess, property game, scoreboards, history
- [ ] **9. Thirsty Thursdays, location, feature requests** — weekly poll cron, opt-in location sharing, request voting + Claude Code prompt generator
- [ ] **10. Admin + polish** — /admin dashboard, logs, PWA install, dark/light, animations
