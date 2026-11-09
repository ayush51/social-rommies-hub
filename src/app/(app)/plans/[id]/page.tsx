import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { PlanComments } from "@/components/plan-comments";
import { PlanForm } from "@/components/plan-form";
import { PlanStatusButton } from "@/components/plan-status-button";
import { RsvpButtons } from "@/components/rsvp-buttons";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const GROUPS = [
  { key: "in", label: "Going" },
  { key: "maybe", label: "Maybe" },
  { key: "out", label: "Can't make it" },
] as const;

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("*").eq("id", id).maybeSingle();
  if (!plan) notFound();
  const [{ data: rsvps }, { data: comments }, { data: members }] = await Promise.all([
    supabase.from("plan_rsvps").select("user_id, response").eq("plan_id", id),
    supabase.from("plan_comments").select("id, user_id, body").eq("plan_id", id).order("created_at"),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const mine = rsvps?.find((r) => r.user_id === me.userId)?.response;
  const canManage = plan.created_by === me.userId || me.isAdmin;
  const unanswered = (members ?? []).filter((m) => !rsvps?.some((r) => r.user_id === m.user_id)).map((m) => names[m.user_id]);

  return (
    <>
      {(["plans", "plan_rsvps", "plan_comments"] as const).map((t) => (
        <LiveRefresh key={t} table={t} householdId={me.householdId} />
      ))}
      <Link href="/plans" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">All plans</Link>
      <h1 className={`mt-2 text-3xl font-bold tracking-tight ${plan.status === "cancelled" ? "line-through opacity-60" : ""}`}>{plan.title}</h1>
      <p className="mt-1 text-neutral-500">
        <LocalTime iso={plan.starts_at} />{plan.location && ` · ${plan.location}`}
      </p>
      {plan.status === "cancelled" && <p className="mt-1 font-semibold text-red-500">Cancelled</p>}
      {plan.description && <p className="mt-3 whitespace-pre-wrap">{plan.description}</p>}
      <p className="mt-1 text-xs text-neutral-500">Planned by {names[plan.created_by]}</p>

      <div className="mt-5">
        <RsvpButtons planId={plan.id} householdId={me.householdId} userId={me.userId} current={mine} />
      </div>
      <div className="mt-5 space-y-2 text-sm">
        {GROUPS.map((g) => {
          const who = rsvps?.filter((r) => r.response === g.key).map((r) => names[r.user_id]) ?? [];
          return who.length ? <p key={g.key}><b>{g.label}:</b> {who.join(", ")}</p> : null;
        })}
        {unanswered.length > 0 && <p className="text-neutral-500">Haven&apos;t answered: {unanswered.join(", ")}</p>}
      </div>

      <div className="mt-8">
        <PlanComments planId={plan.id} householdId={me.householdId} userId={me.userId} isAdmin={me.isAdmin} names={names} comments={comments ?? []} />
      </div>

      {canManage && (
        <div className="mt-8 space-y-4">
          <details className="rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
            <summary className="cursor-pointer py-3 font-semibold">Edit plan</summary>
            <div className="mt-3"><PlanForm householdId={me.householdId} userId={me.userId} plan={plan} /></div>
          </details>
          <PlanStatusButton planId={plan.id} status={plan.status} />
        </div>
      )}
    </>
  );
}
