// Builds the Claude Code prompt for approved feature requests. Pure (no imports) so the admin UI and
// scripts/feature-prompt.ts share one template.

export type PromptRequest = {
  title: string;
  description: string | null;
  requester: string;
  votes: number;
  note: string | null;
  comments: { author: string; body: string }[];
};

const CONTEXT = `You are working in The Couch repo: a private PWA for six roommates (Next.js 16 App Router, TypeScript, Tailwind, Supabase Postgres/Auth/Realtime/Storage, deployed on Vercel). The in-app currency is "bingdons".

Before you write code:
- Read AGENTS.md and the relevant guide in node_modules/next/dist/docs/ (this Next.js has breaking changes; proxy.ts replaces middleware, Cache Components need <Suspense> around cookies()/dynamic data).
- Read ARCHITECTURE.md and TASKS.md, then look at how a similar feature is built (migrations in supabase/migrations, tests in supabase/tests, UI in src/app/(app) and src/components).
- Keep code lean and match the surrounding style. Build only what this request needs. Say what files you will add and why before writing non-trivial ones.

Non-negotiable rules:
- Every table has household_id and Row Level Security. Clients get no direct writes to anything involving money, votes or other people's data; do those through security-definer SQL functions that validate the caller.
- Bingdons only move through the append-only ledger (public.post_ledger) with idempotency keys. Never edit or delete ledger rows.
- No service-role key in client code. No secrets in the repo (it is public).
- Add rollback-based SQL tests in supabase/tests/rls_*.sql for new tables/functions (follow the existing files) and run them with: supabase db query --linked -f supabase/tests/<file>.sql  (success is the message "ALL RLS TESTS PASSED (rolled back)").
- Run eslint, tsc and next build before you finish. Update README.md / TASKS.md if behavior changes.
- Do NOT deploy or push. Stop when it is built and tested, and summarise what changed so a human can review it first.`;

function section(r: PromptRequest, index?: number) {
  const lines = [
    `${index ? `### Feature ${index}: ` : "### "}${r.title}`,
    `Requested by ${r.requester}; ${r.votes} ${r.votes === 1 ? "vote" : "votes"} from the house.`,
    r.description ? `\nWhat they asked for:\n${r.description}` : "",
    r.note ? `\nAdmin note: ${r.note}` : "",
    r.comments.length ? `\nHousemate comments:\n${r.comments.map((c) => `- ${c.author}: ${c.body}`).join("\n")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function buildPrompt(r: PromptRequest) {
  return `${CONTEXT}\n\n## Task\nImplement this approved feature request.\n\n${section(r)}\n\nAcceptance: it works on a phone-width screen, respects RLS, has tests for any new database logic, and passes lint/type-check/build.`;
}

export function buildBatchPrompt(requests: PromptRequest[]) {
  if (requests.length === 0) return "No approved feature requests.";
  if (requests.length === 1) return buildPrompt(requests[0]);
  return `${CONTEXT}\n\n## Tasks\nImplement these approved feature requests one at a time, most-voted first. Finish and verify each before starting the next, and keep them in separate migrations.\n\n${requests.map((r, i) => section(r, i + 1)).join("\n\n")}\n\nAcceptance for each: works on a phone-width screen, respects RLS, has tests for new database logic, and passes lint/type-check/build.`;
}
