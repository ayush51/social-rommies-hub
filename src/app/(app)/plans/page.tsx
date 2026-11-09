import Link from "next/link";
import { Plus } from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function PlansPage() {
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: plans }, { data: rsvps }] = await Promise.all([
    supabase.from("plans").select("id, title, location, starts_at, status").order("starts_at"),
    supabase.from("plan_rsvps").select("plan_id, user_id, response"),
  ]);
  const cutoff = Date.now() - 3 * 3600_000;
  const upcoming = (plans ?? []).filter((p) => new Date(p.starts_at).getTime() >= cutoff);
  const past = (plans ?? []).filter((p) => new Date(p.starts_at).getTime() < cutoff).reverse();

  const row = (p: NonNullable<typeof plans>[number]) => {
    const going = rsvps?.filter((r) => r.plan_id === p.id && r.response === "in").length ?? 0;
    const mine = rsvps?.find((r) => r.plan_id === p.id && r.user_id === me.userId)?.response;
    return (
      <li key={p.id}>
        <Link href={`/plans/${p.id}`} className="block rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
          <p className={`font-semibold ${p.status === "cancelled" ? "line-through opacity-60" : ""}`}>{p.title}</p>
          <p className="text-sm text-neutral-500">
            <LocalTime iso={p.starts_at} />{p.location && ` · ${p.location}`}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {p.status === "cancelled" ? "Cancelled" : `${going} going${mine ? ` · you: ${mine}` : " · you haven't answered"}`}
          </p>
        </Link>
      </li>
    );
  };

  return (
    <>
      <LiveRefresh table="plans" householdId={me.householdId} />
      <LiveRefresh table="plan_rsvps" householdId={me.householdId} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
        <Link href="/plans/new" className="flex items-center gap-1 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white">
          <Plus size={16} /> New
        </Link>
      </div>
      {upcoming.length === 0 && <p className="mt-4 text-neutral-500">Nothing planned. Start something.</p>}
      <ul className="mt-4 space-y-2">{upcoming.map(row)}</ul>
      {past.length > 0 && (
        <>
          <h2 className="mt-8 font-semibold text-neutral-500">Past</h2>
          <ul className="mt-2 space-y-2 opacity-70">{past.map(row)}</ul>
        </>
      )}
    </>
  );
}
