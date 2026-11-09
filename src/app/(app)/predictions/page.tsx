import Link from "next/link";
import { Plus } from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { getMe } from "@/lib/session";
import { nowMs } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";

export default async function PredictionsPage() {
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: markets }, { data: bets }, { data: members }] = await Promise.all([
    supabase.from("markets").select("id, question, closes_at, status, resolver_id").order("created_at", { ascending: false }).limit(60),
    supabase.from("market_bets").select("market_id, user_id, amount"),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const now = nowMs();
  const pool = (id: string) => (bets ?? []).filter((b) => b.market_id === id).reduce((s, b) => s + b.amount, 0);
  const mine = (id: string) => (bets ?? []).find((b) => b.market_id === id && b.user_id === me.userId)?.amount;

  const open = (markets ?? []).filter((m) => m.status === "open" && new Date(m.closes_at).getTime() > now);
  const waiting = (markets ?? []).filter((m) => m.status === "open" && new Date(m.closes_at).getTime() <= now);
  const settled = (markets ?? []).filter((m) => m.status !== "open");

  const card = (m: NonNullable<typeof markets>[number], note: string) => (
    <li key={m.id}>
      <Link href={`/predictions/${m.id}`} className="block rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
        <p className={`font-semibold ${m.status === "cancelled" ? "line-through opacity-60" : ""}`}>{m.question}</p>
        <p className="mt-0.5 text-sm text-neutral-500">{note}</p>
        <p className="mt-1 text-xs text-neutral-500">
          Pool {pool(m.id)} bingdons{mine(m.id) ? ` · you bet ${mine(m.id)}` : ""} · resolver {names[m.resolver_id]}
        </p>
      </Link>
    </li>
  );

  return (
    <>
      {(["markets", "market_bets"] as const).map((t) => <LiveRefresh key={t} table={t} householdId={me.householdId} />)}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Predictions</h1>
        <Link href="/predictions/new" className="flex items-center gap-1 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> New</Link>
      </div>
      <p className="mt-1 text-sm text-neutral-500">Bet bingdons on what happens. Winners split the pool.</p>

      <h2 className="mt-6 font-semibold">Open</h2>
      {open.length === 0 && <p className="mt-2 text-sm text-neutral-500">Nothing open. Start one.</p>}
      <ul className="mt-2 space-y-2">{open.map((m) => card(m, `Betting closes ${new Date(m.closes_at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`))}</ul>

      {waiting.length > 0 && (
        <>
          <h2 className="mt-6 font-semibold">Waiting for the resolver</h2>
          <ul className="mt-2 space-y-2">{waiting.map((m) => card(m, m.resolver_id === me.userId ? "Your call to make" : `${names[m.resolver_id]} needs to call it`))}</ul>
        </>
      )}

      {settled.length > 0 && (
        <>
          <h2 className="mt-6 font-semibold text-neutral-500">Settled</h2>
          <ul className="mt-2 space-y-2 opacity-80">{settled.map((m) => card(m, m.status === "resolved" ? "Resolved" : "Cancelled"))}</ul>
        </>
      )}
    </>
  );
}
