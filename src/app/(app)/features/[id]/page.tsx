import Link from "next/link";
import { notFound } from "next/navigation";
import { FeatureComments } from "@/components/feature-comments";
import { FeatureVote } from "@/components/feature-vote";
import { LiveRefresh } from "@/components/live-refresh";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const LABEL: Record<string, string> = {
  proposed: "Waiting for Ayush",
  approved: "Approved",
  building: "Being built",
  shipped: "Shipped",
  rejected: "Not doing",
};

export default async function FeaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  const supabase = await createClient();
  const { data: request } = await supabase.from("feature_requests").select("*").eq("id", id).maybeSingle();
  if (!request) notFound();
  const [{ data: votes }, { data: comments }, { data: members }] = await Promise.all([
    supabase.from("feature_votes").select("user_id").eq("request_id", id),
    supabase.from("feature_comments").select("id, user_id, body").eq("request_id", id).order("created_at"),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));

  return (
    <>
      {(["feature_requests", "feature_votes", "feature_comments"] as const).map((t) => <LiveRefresh key={t} table={t} householdId={me.householdId} />)}
      <Link href="/features" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">All ideas</Link>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">{request.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">{LABEL[request.status]} · suggested by {names[request.created_by]}</p>
        </div>
        <FeatureVote requestId={id} householdId={me.householdId} userId={me.userId} count={votes?.length ?? 0} voted={!!votes?.some((v) => v.user_id === me.userId)} />
      </div>
      {request.description && <p className="mt-4 whitespace-pre-wrap">{request.description}</p>}
      {request.admin_note && <p className="mt-4 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900"><b>Ayush:</b> {request.admin_note}</p>}
      <div className="mt-8">
        <FeatureComments requestId={id} householdId={me.householdId} userId={me.userId} isAdmin={me.isAdmin} names={names} comments={comments ?? []} />
      </div>
    </>
  );
}
