"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/app/(app)/push-actions";
import { createClient } from "@/lib/supabase/client";

const btn = "min-h-11 rounded-2xl px-4 py-2 text-sm font-semibold active:scale-95 disabled:opacity-50";

export function CreateGameForm() {
  const router = useRouter();
  const [buyIn, setBuyIn] = useState(5);
  const [max, setMax] = useState(4);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <section className="rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <h2 className="font-semibold">Open a lobby</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold">
        <label>Buy-in (bingdons)
          <select value={buyIn} onChange={(e) => setBuyIn(Number(e.target.value))} className="mt-1 h-11 w-full rounded-2xl bg-white px-3 text-sm font-normal dark:bg-neutral-800">
            {[0, 5, 10, 25].map((n) => <option key={n} value={n}>{n === 0 ? "Free" : n}</option>)}
          </select>
        </label>
        <label>Max players
          <select value={max} onChange={(e) => setMax(Number(e.target.value))} className="mt-1 h-11 w-full rounded-2xl bg-white px-3 text-sm font-normal dark:bg-neutral-800">
            {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Everyone pays the buy-in; the winner takes the whole pot.</p>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const { data, error } = await createClient().rpc("monopoly_create", { p_buy_in: buyIn, p_max: max });
            if (error) return setError(error.message.includes("enough") ? "You don't have enough bingdons for that buy-in." : error.message.includes("already") ? "You already have an open lobby." : "Couldn't open the lobby.");
            const r = data as { game: string; event: string };
            void notify("game", r.event);
            router.push(`/games/monopoly/${r.game}`);
          })
        }
        className={`${btn} mt-3 w-full bg-violet-600 text-white`}
      >
        {pending ? "Opening…" : "Open lobby"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}

type Props = { gameId: string; isMember: boolean; isHost: boolean; count: number; max: number; buyIn: number };

export function LobbyActions({ gameId, isMember, isHost, count, max, buyIn }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: "monopoly_join" | "monopoly_leave" | "monopoly_start" | "monopoly_cancel") =>
    start(async () => {
      const { data, error } = await createClient().rpc(fn, { p_game: gameId });
      if (error) setError(error.message.includes("enough") ? "You don't have enough bingdons for the buy-in." : error.message.replace(/^.*?: /, ""));
      else {
        setError(undefined);
        const ev = (data as { event?: string } | null)?.event;
        if (ev) void notify("game", ev);
      }
      router.refresh();
    });

  return (
    <section className="space-y-2 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <p className="font-semibold">Lobby · {count} of {max} players · {buyIn ? `${buyIn} bingdon buy-in` : "free"}</p>
      <div className="flex flex-wrap gap-2">
        {!isMember && <button disabled={pending || count >= max} onClick={() => run("monopoly_join")} className={`${btn} bg-violet-600 text-white`}>{count >= max ? "Lobby full" : `Join${buyIn ? ` (${buyIn} bingdons)` : ""}`}</button>}
        {isMember && !isHost && <button disabled={pending} onClick={() => run("monopoly_leave")} className={`${btn} bg-white dark:bg-neutral-800`}>Leave (refund)</button>}
        {isHost && <button disabled={pending || count < 2} onClick={() => run("monopoly_start")} className={`${btn} bg-violet-600 text-white`}>{count < 2 ? "Need 2+ players" : "Start the game"}</button>}
        {isHost && <button disabled={pending} onClick={() => run("monopoly_cancel")} className={`${btn} bg-white dark:bg-neutral-800`}>Cancel lobby</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    </section>
  );
}
