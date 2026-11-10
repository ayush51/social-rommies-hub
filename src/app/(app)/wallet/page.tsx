import Link from "next/link";
import { Coins, Trophy } from "lucide-react";
import { ClaimButton } from "@/components/claim-button";
import { LiveRefresh } from "@/components/live-refresh";
import { ShopItem } from "@/components/shop-item";
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
  const [{ data: items }, { data: mine }, { data: passes }, { data: history }, { data: members }] = await Promise.all([
    supabase.from("shop_items").select("code, name, description, price").order("sort"),
    supabase.from("profiles").select("badge").eq("id", me.userId).single(),
    supabase.from("shop_purchases").select("id").eq("item_code", "question_pass").is("used_at", null),
    supabase.from("ledger_entries").select("id, amount, kind, created_at, counterparty").order("id", { ascending: false }).limit(50),
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

      <h2 className="mt-8 font-semibold">Shop</h2>
      <ul className="mt-2 space-y-2">
        {(items ?? []).map((i) => (
          <ShopItem
            key={i.code}
            code={i.code as "badge_star"}
            name={i.name}
            description={i.description}
            price={i.price}
            balance={Number(balance ?? 0)}
            owned={i.code === `badge_${mine?.badge}`}
            count={i.code === "question_pass" ? passes?.length : undefined}
          />
        ))}
      </ul>

      <Link href="/leaderboard" className="mt-8 flex min-h-11 items-center justify-between rounded-3xl bg-neutral-100 px-5 py-4 dark:bg-neutral-900">
        <span className="flex items-center gap-2 font-semibold"><Trophy size={18} className="text-amber-500" aria-hidden /> Leaderboard</span>
        <span className="text-sm text-neutral-500">See who has the most</span>
      </Link>

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
