import { BatchPrompt } from "@/components/batch-prompt";
import { FeatureAdmin } from "@/components/feature-admin";
import type { PromptRequest } from "@/lib/feature-prompt";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminFeatures() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: requests }, { data: votes }, { data: comments }, { data: members }] = await Promise.all([
    supabase.from("feature_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("feature_votes").select("request_id"),
    supabase.from("feature_comments").select("request_id, user_id, body").order("created_at"),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const asPrompt = (r: NonNullable<typeof requests>[number]): PromptRequest => ({
    title: r.title,
    description: r.description,
    requester: names[r.created_by] ?? "a roommate",
    votes: (votes ?? []).filter((v) => v.request_id === r.id).length,
    note: r.admin_note,
    comments: (comments ?? []).filter((c) => c.request_id === r.id).map((c) => ({ author: names[c.user_id] ?? "", body: c.body })),
  });
  const approved = (requests ?? []).filter((r) => r.status === "approved").map(asPrompt).sort((a, b) => b.votes - a.votes);
  const ORDER = ["proposed", "approved", "building", "shipped", "rejected"];
  const sorted = [...(requests ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Feature requests</h1>
      <div className="mt-4"><BatchPrompt approved={approved} /></div>
      {sorted.length === 0 && <p className="mt-4 text-neutral-500">No requests yet.</p>}
      <ul className="mt-4 space-y-3">
        {sorted.map((r) => (
          <li key={r.id} className="rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
            <p className="font-semibold">{r.title}</p>
            <p className="text-xs text-neutral-500">{names[r.created_by]} · {(votes ?? []).filter((v) => v.request_id === r.id).length} votes · {r.status}</p>
            {r.description && <p className="mt-2 whitespace-pre-wrap text-sm">{r.description}</p>}
            <FeatureAdmin id={r.id} status={r.status} note={r.admin_note} request={asPrompt(r)} />
          </li>
        ))}
      </ul>
    </>
  );
}
