import Link from "next/link";
import { Crown, Medal, Minus, Star, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { LiveRefresh } from "@/components/live-refresh";
import { ranked, type LeaderRow } from "@/lib/leaderboard";
import { signedUrls } from "@/lib/photos";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const MEDAL = ["text-amber-500", "text-neutral-400", "text-orange-700"];

export default async function LeaderboardPage() {
  const me = await getMe();
  const supabase = await createClient();
  const { data } = await supabase.rpc("bingdon_leaderboard");
  const rows = ranked((data ?? []) as unknown as LeaderRow[]);
  const avatars = await signedUrls(rows.map((r) => r.avatar), "avatars");
  const podium = rows.filter((r) => r.rank <= 3).slice(0, 3);
  // visual order: 2nd, 1st, 3rd
  const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  const Badge = ({ b }: { b: string | null }) =>
    b === "crown" ? <Crown size={14} className="text-amber-500" aria-label="Crown" /> : b === "star" ? <Star size={14} className="text-amber-500" aria-label="Gold star" /> : null;

  return (
    <>
      <LiveRefresh table="wallets" householdId={me.householdId} />
      <Link href="/wallet" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Wallet</Link>
      <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><Trophy size={26} className="text-amber-500" aria-hidden /> Leaderboard</h1>
      <p className="mt-1 text-sm text-neutral-500">Who has the most bingdons. &quot;This week&quot; is each person&apos;s net change over the last 7 days.</p>

      {podium.length > 0 && (
        <section aria-label="Top three" className="mt-6 grid grid-cols-3 items-end gap-2">
          {order.map((r) => (
            <div key={r.user_id} className={`flex flex-col items-center rounded-3xl px-2 pb-3 pt-4 text-center ${r.rank === 1 ? "bg-violet-600 text-white" : "bg-neutral-100 dark:bg-neutral-900"}`} style={{ minHeight: r.rank === 1 ? 190 : 150 }}>
              <Medal size={22} className={r.rank === 1 ? "text-amber-300" : MEDAL[Math.min(r.rank, 3) - 1]} aria-hidden />
              <Avatar url={r.avatar ? avatars.get(r.avatar) : null} name={r.name} size={r.rank === 1 ? 56 : 44} />
              <p className="mt-1 flex items-center gap-1 text-sm font-semibold">{r.name}<Badge b={r.badge} /></p>
              <p className="text-lg font-bold tabular-nums">{r.balance}</p>
              <p className="sr-only">Rank {r.rank}</p>
            </div>
          ))}
        </section>
      )}

      <ol className="mt-6 space-y-2">
        {rows.map((r) => (
          <li key={r.user_id} className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-2 ${r.user_id === me.userId ? "bg-violet-100 ring-2 ring-violet-500 dark:bg-violet-950" : "bg-neutral-100 dark:bg-neutral-900"}`}>
            <span className="w-6 text-center font-bold tabular-nums text-neutral-500">{r.rank}</span>
            <Avatar url={r.avatar ? avatars.get(r.avatar) : null} name={r.name} size={36} />
            <span className="flex min-w-0 flex-1 items-center gap-1 font-semibold">
              <span className="truncate">{r.name}</span><Badge b={r.badge} />
              {r.user_id === me.userId && <span className="ml-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">you</span>}
            </span>
            <span className="text-right">
              <span className="block font-bold tabular-nums">{r.balance}</span>
              <span className={`flex items-center justify-end gap-0.5 text-xs tabular-nums ${r.week > 0 ? "text-green-600" : r.week < 0 ? "text-red-500" : "text-neutral-400"}`}>
                {r.week > 0 ? <TrendingUp size={12} aria-hidden /> : r.week < 0 ? <TrendingDown size={12} aria-hidden /> : <Minus size={12} aria-hidden />}
                {r.week > 0 ? "+" : ""}{r.week} this week
              </span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
