import Link from "next/link";
import { notFound } from "next/navigation";
import { BetPanel } from "@/components/bet-panel";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { ResolvePanel } from "@/components/resolve-panel";
import { getMe } from "@/lib/session";
import { nowMs } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  const supabase = await createClient();
  const { data: market } = await supabase.from("markets").select("*").eq("id", id).maybeSingle();
  if (!market) notFound();
  const [{ data: options }, { data: bets }, { data: members }, { data: balance }, { data: myLedger }] = await Promise.all([
    supabase.from("market_options").select("id, label, position").eq("market_id", id).order("position"),
    supabase.from("market_bets").select("user_id, option_id, amount").eq("market_id", id),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
    supabase.rpc("my_wallet"),
    supabase.from("ledger_entries").select("kind, amount").eq("ref", id),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const opts = (options ?? []).map((o) => ({ ...o, pool: (bets ?? []).filter((b) => b.option_id === o.id).reduce((s, b) => s + b.amount, 0) }));
  const total = opts.reduce((s, o) => s + o.pool, 0);
  const mine = bets?.find((b) => b.user_id === me.userId);
  const isResolver = market.resolver_id === me.userId;
  const closed = nowMs() >= new Date(market.closes_at).getTime();
  const bettingOpen = market.status === "open" && !closed;
  const canSettle = market.status === "open" && (isResolver || me.isAdmin);
  const winner = opts.find((o) => o.id === market.resolved_option_id);
  const net = (myLedger ?? []).reduce((s, e) => s + e.amount, 0);

  return (
    <>
      {(["markets", "market_bets"] as const).map((t) => <LiveRefresh key={t} table={t} householdId={me.householdId} />)}
      <Link href="/predictions" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Predictions</Link>
      <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight">{market.question}</h1>
      {market.description && <p className="mt-2 text-neutral-600 dark:text-neutral-400">{market.description}</p>}
      <p className="mt-2 text-sm text-neutral-500">
        {market.status === "open"
          ? closed ? "Betting is closed." : <>Betting closes <LocalTime iso={market.closes_at} />.</>
          : market.status === "resolved" ? "Resolved." : "Cancelled."}{" "}
        Resolver: {names[market.resolver_id]}. Started by {names[market.created_by]}.
      </p>

      {market.status === "resolved" && winner && (
        <section className="mt-4 rounded-3xl bg-violet-600 p-5 text-white">
          <p className="text-sm text-violet-100">Result</p>
          <p className="mt-1 text-2xl font-bold">{winner.label}</p>
          {mine && <p className="mt-2 text-sm text-violet-100">{net > 0 ? `You won ${net} bingdons.` : net < 0 ? `You lost ${-net} bingdons.` : "You broke even."}</p>}
        </section>
      )}
      {market.status === "cancelled" && <p className="mt-4 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">{market.cancel_reason}</p>}

      <ul className="mt-4 space-y-2">
        {opts.map((o) => (
          <li key={o.id} className={`relative overflow-hidden rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900 ${winner?.id === o.id ? "ring-2 ring-violet-600" : ""}`}>
            <span className="absolute inset-y-0 left-0 bg-violet-200/60 dark:bg-violet-900/50" style={{ width: `${total ? (o.pool / total) * 100 : 0}%` }} />
            <span className="relative flex items-center justify-between gap-3">
              <span className="font-medium">{o.label}{mine?.option_id === o.id && <span className="ml-2 text-xs text-violet-600 dark:text-violet-400">your pick</span>}</span>
              <span className="text-right text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
                {o.pool} · {total ? Math.round((o.pool / total) * 100) : 0}%{o.pool > 0 && total > 0 ? ` · pays ${(total / o.pool).toFixed(2)}x` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-neutral-500">Pool: {total} bingdons</p>

      <div className="mt-5 space-y-4">
        {bettingOpen && !isResolver && (
          <BetPanel marketId={market.id} options={opts} myOption={mine?.option_id ?? null} myAmount={mine?.amount ?? 0} balance={Number(balance ?? 0)} />
        )}
        {bettingOpen && isResolver && <p className="rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">You&apos;re the resolver, so you can&apos;t bet on this one.</p>}
        {canSettle && <ResolvePanel marketId={market.id} options={opts} isResolver={isResolver} />}
      </div>

      {(bets ?? []).length > 0 && (
        <>
          <h2 className="mt-8 font-semibold">Bets</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(bets ?? []).map((b) => (
              <li key={b.user_id} className="flex justify-between">
                <span>{names[b.user_id]}</span>
                <span className="text-neutral-500">{b.amount} on {opts.find((o) => o.id === b.option_id)?.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
