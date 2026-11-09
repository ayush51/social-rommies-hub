import Link from "next/link";
import { FeatureForm } from "@/components/feature-form";
import { FeatureVote } from "@/components/feature-vote";
import { LiveRefresh } from "@/components/live-refresh";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const GROUPS = [
  { key: "proposed", label: "Waiting for Ayush" },
  { key: "approved", label: "Approved" },
  { key: "building", label: "Being built" },
  { key: "shipped", label: "Shipped" },
  { key: "rejected", label: "Not doing" },
] as const;

export default async function FeaturesPage() {
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: requests }, { data: votes }, { data: comments }, { data: members }] = await Promise.all([
    supabase.from("feature_requests").select("id, title, status, created_by, created_at").order("created_at", { ascending: false }),
    supabase.from("feature_votes").select("request_id, user_id"),
    supabase.from("feature_comments").select("request_id"),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const count = (id: string) => (votes ?? []).filter((v) => v.request_id === id).length;

  return (
    <>
      {(["feature_requests", "feature_votes"] as const).map((t) => <LiveRefresh key={t} table={t} householdId={me.householdId} />)}
      <Link href="/" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Home</Link>
      <h1 className="mb-4 mt-2 text-3xl font-bold tracking-tight">Feature ideas</h1>
      <FeatureForm householdId={me.householdId} userId={me.userId} />

      {GROUPS.map((g) => {
        const items = (requests ?? []).filter((r) => r.status === g.key).sort((a, b) => count(b.id) - count(a.id));
        if (!items.length) return null;
        return (
          <section key={g.key} className="mt-6">
            <h2 className={`font-semibold ${g.key === "rejected" ? "text-neutral-500" : ""}`}>{g.label}</h2>
            <ul className="mt-2 space-y-2">
              {items.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
                  <Link href={`/features/${r.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-xs text-neutral-500">
                      {names[r.created_by]} · {(comments ?? []).filter((c) => c.request_id === r.id).length} comments
                    </p>
                  </Link>
                  <FeatureVote requestId={r.id} householdId={me.householdId} userId={me.userId} count={count(r.id)} voted={!!votes?.some((v) => v.request_id === r.id && v.user_id === me.userId)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
