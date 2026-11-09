"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; label: string; pool: number };
type Props = { marketId: string; options: Option[]; myOption: string | null; myAmount: number; balance: number };

const CHIPS = [5, 10, 25, 50];

export function BetPanel({ marketId, options, myOption, myAmount, balance }: Props) {
  const router = useRouter();
  const [option, setOption] = useState(myOption ?? options[0].id);
  const [amount, setAmount] = useState(10);
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();

  const total = options.reduce((s, o) => s + o.pool, 0);
  const chosen = options.find((o) => o.id === option)!;
  const stake = (myOption === option ? myAmount : 0) + amount;
  const estimate = Math.floor((stake * (total + amount)) / (chosen.pool + amount));

  const place = () =>
    start(async () => {
      const { error } = await createClient().rpc("place_bet", { p_market: marketId, p_option: option, p_amount: amount, p_key: crypto.randomUUID() });
      setMsg(
        !error ? `Bet placed: ${amount} on ${chosen.label}.`
        : error.message.includes("insufficient") ? "Not enough bingdons."
        : error.message.includes("another option") ? "You already backed another option."
        : error.message.includes("closed") ? "Betting just closed."
        : "Couldn't place that bet.",
      );
      router.refresh();
    });

  return (
    <section className="rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <h2 className="font-semibold">{myOption ? "Add to your bet" : "Place a bet"}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            disabled={!!myOption && myOption !== o.id}
            onClick={() => setOption(o.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 ${option === o.id ? "bg-violet-600 text-white" : "bg-white dark:bg-neutral-800"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {CHIPS.map((c) => (
          <button key={c} onClick={() => setAmount(c)} className={`rounded-full px-3 py-1 text-sm ${amount === c ? "bg-violet-600 text-white" : "bg-white dark:bg-neutral-800"}`}>{c}</button>
        ))}
        <input
          type="number" min={1} max={500} value={amount}
          onChange={(e) => setAmount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
          className="w-20 rounded-2xl bg-white px-3 py-1 text-sm dark:bg-neutral-800"
        />
      </div>
      <p className="mt-3 text-sm text-neutral-500">
        If {chosen.label} wins you&apos;d get about {estimate} back (it changes as others bet). You have {balance} bingdons.
      </p>
      <button disabled={pending || amount > balance} onClick={place} className="mt-3 w-full rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-50">
        {pending ? "Placing…" : `Bet ${amount} on ${chosen.label}`}
      </button>
      {msg && <p className="mt-2 text-sm text-neutral-500">{msg}</p>}
    </section>
  );
}
