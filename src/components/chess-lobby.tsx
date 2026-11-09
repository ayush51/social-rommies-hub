"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const COLORS = [["random", "Random"], ["white", "White"], ["black", "Black"]] as const;

export function ChessCreateForm() {
  const router = useRouter();
  const [buyIn, setBuyIn] = useState(0);
  const [color, setColor] = useState<(typeof COLORS)[number][0]>("random");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <section className="rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <h2 className="font-semibold">Challenge a roommate</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold">
        <label>Buy-in (bingdons)
          <select value={buyIn} onChange={(e) => setBuyIn(Number(e.target.value))} className="mt-1 h-11 w-full rounded-2xl bg-white px-3 text-sm font-normal dark:bg-neutral-800">
            {[0, 1, 2, 5, 10, 25].map((n) => <option key={n} value={n}>{n === 0 ? "Free" : n}</option>)}
          </select>
        </label>
        <label>You play
          <select value={color} onChange={(e) => setColor(e.target.value as typeof color)} className="mt-1 h-11 w-full rounded-2xl bg-white px-3 text-sm font-normal dark:bg-neutral-800">
            {COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Both players pay the buy-in. The winner takes the pot; a draw refunds both.</p>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const { data, error } = await createClient().rpc("chess_create", { p_buy_in: buyIn, p_color: color });
            if (error) return setError(error.message.includes("enough") ? "You don't have enough bingdons for that buy-in." : error.message.includes("already") ? "You already have an open lobby." : "Couldn't open the game.");
            router.push(`/games/chess/${(data as { game: string }).game}`);
          })
        }
        className="mt-3 min-h-11 w-full rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
      >
        {pending ? "Opening…" : "Open game"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}
