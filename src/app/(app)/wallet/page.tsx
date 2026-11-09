import { Coins } from "lucide-react";
import { ClaimButton } from "@/components/claim-button";
import { LiveRefresh } from "@/components/live-refresh";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const describe = (kind: string, other?: string | null) =>
  ({
    starting: "Welcome bonus",
    daily: "Daily reward",
    tip_out: `Tip to ${other ?? "a roommate"}`,
    tip_in: `Tip from ${other ?? "a roommate"}`,
    game: "Daily card vote",
    poll: "Thirsty Thursday vote",
    adjustment: "Correction",
    bet_out: "Prediction bet",
    bet_payout: "Prediction win",
    bet_refund: "Prediction refund",
  })[kind] ?? kind;

export default async function WalletPage() {
  const me = await getMe();
  const supabase = await createClient();
  const { data: balance } = await supabase.rpc("my_wallet"); // creates the wallet + welcome bonus on first visit
  const [{ data: history }, { data: board }, { data: members }] = await Promise.all([
    supabase.from("ledger_entries").select("id, amount, kind, created_at, counterparty").order("id", { ascending: false }).limit(50),
    supabase.from("wallets").select("user_id, balance").order("balance", { ascending: false }),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));

  return (
    <>
      <LiveRefresh table="wallets" householdId={me.householdId} />
      <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
      <section className="mt-4 rounded-3xl bg-violet-600 p-5 text-white">
        <p className="flex items-center gap-2 text-sm text-violet-100"><Coins size={16} /> Wallet</p>
        <p className="mt-1 text-4xl font-bold">I have <span className="tabular-nums">{balance ?? 0}</span> {balance === 1 ? "bingdon" : "bingdons"}</p>
        <div className="mt-4"><ClaimButton /></div>
      </section>

      <h2 className="mt-8 font-semibold">Leaderboard</h2>
      <ol className="mt-2 space-y-1">
        {board?.map((w, i) => (
          <li key={w.user_id} className="flex justify-between rounded-2xl bg-neutral-100 px-4 py-2 dark:bg-neutral-900">
            <span><span className="mr-2 text-neutral-500">{i + 1}</span>{names[w.user_id]}</span>
            <span className="tabular-nums">{w.balance}</span>
          </li>
        ))}
      </ol>

      <h2 className="mt-8 font-semibold">History</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {history?.length === 0 && <li className="text-neutral-500">Nothing yet.</li>}
        {history?.map((e) => (
          <li key={e.id} className="flex justify-between border-b border-neutral-200 py-2 dark:border-neutral-800">
            <span>
              {describe(e.kind, e.counterparty && names[e.counterparty])}
              <span className="ml-2 text-xs text-neutral-500">{new Date(e.created_at).toLocaleDateString()}</span>
            </span>
            <span className={`tabular-nums ${e.amount > 0 ? "text-green-600" : "text-neutral-500"}`}>
              {e.amount > 0 ? "+" : ""}{e.amount}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
