import Link from "next/link";
import { Coins } from "lucide-react";
import type { CardHistory } from "@/lib/cards";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function GamesPage() {
  await getMe();
  const supabase = await createClient();
  const [{ data: balance }, { data: raw }] = await Promise.all([supabase.rpc("my_wallet"), supabase.rpc("card_history", { p_limit: 7 })]);
  const history = raw as unknown as CardHistory | null;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Games</h1>

      <Link href="/wallet" className="mt-4 flex items-center justify-between rounded-3xl bg-violet-600 px-5 py-4 text-white">
        <span className="flex items-center gap-2 font-semibold"><Coins size={18} /> Wallet</span>
        <span className="text-lg font-bold tabular-nums">I have {balance ?? 0} {balance === 1 ? "bingdon" : "bingdons"}</span>
      </Link>

      <Link href="/predictions" className="mt-3 flex items-center justify-between rounded-3xl bg-neutral-100 px-5 py-4 dark:bg-neutral-900">
        <span className="font-semibold">Predictions</span>
        <span className="text-sm text-neutral-500">Bet bingdons on what happens</span>
      </Link>

      <h2 className="mt-8 font-semibold">Daily card: most-voted</h2>
      {history?.scores.length ? (
        <ol className="mt-2 space-y-1">
          {history.scores.map((s, i) => (
            <li key={s.name} className="flex justify-between rounded-2xl bg-neutral-100 px-4 py-2 dark:bg-neutral-900">
              <span><span className="mr-2 text-neutral-500">{i + 1}</span>{s.name}</span>
              <span className="tabular-nums">{s.wins} {s.wins === 1 ? "day" : "days"}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">Nobody&apos;s been voted yet. Vote on today&apos;s card on Home.</p>
      )}

      <h2 className="mt-8 font-semibold">Past rounds</h2>
      <div className="mt-2 space-y-3">
        {history?.rounds.length === 0 && <p className="text-sm text-neutral-500">Rounds show up here the day after they&apos;re played.</p>}
        {history?.rounds.map((r) => (
          <article key={r.date} className="rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
            <p className="text-xs text-neutral-500">{new Date(`${r.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
            <p className="mt-1 font-semibold">{r.prompt}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {r.results.map((x) => (
                <li key={x.name} className="flex justify-between gap-3">
                  <span className={r.winners.includes(x.name) ? "font-semibold" : ""}>{x.name}</span>
                  <span className="shrink-0 text-neutral-500">{x.votes}</span>
                </li>
              ))}
            </ul>
            {r.winners.length > 0 && <p className="mt-2 text-sm font-semibold text-violet-600 dark:text-violet-400">Most likely: {r.winners.join(", ")}</p>}
          </article>
        ))}
      </div>

      <h2 className="mt-8 font-semibold">Coming soon</h2>
      <p className="mt-1 text-sm text-neutral-500">Chess and a property game.</p>
    </>
  );
}
