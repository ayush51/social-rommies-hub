// Prints a Claude Code prompt for the feature requests Ayush has approved in admin mode.
//   node scripts/feature-prompt.ts            approved requests, most-voted first
//   node scripts/feature-prompt.ts all        every request that is not rejected/shipped
// Use it in a terminal:  claude "$(node scripts/feature-prompt.ts)"
import { execFileSync } from "node:child_process";
import { buildBatchPrompt, type PromptRequest } from "../src/lib/feature-prompt.ts";

const statuses = process.argv[2] === "all" ? "'proposed','approved','building'" : "'approved'";
const sql = `
  select r.title, r.description, r.admin_note as note, p.display_name as requester,
    (select count(*)::int from public.feature_votes v where v.request_id = r.id) as votes,
    coalesce((select json_agg(json_build_object('author', cp.display_name, 'body', c.body) order by c.created_at)
              from public.feature_comments c join public.profiles cp on cp.id = c.user_id where c.request_id = r.id), '[]'::json) as comments
  from public.feature_requests r join public.profiles p on p.id = r.created_by
  where r.status in (${statuses})
  order by votes desc, r.created_at`;

const raw = execFileSync("supabase", ["db", "query", "--linked", "--output-format", "json", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const rows = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)).rows as PromptRequest[];
console.log(buildBatchPrompt(rows));
