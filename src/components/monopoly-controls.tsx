"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/app/(app)/push-actions";
import { createClient } from "@/lib/supabase/client";

type Upgrade = { space: number; name: string; level: number; cost: number; affordable: boolean };
type Props = {
  gameId: string;
  isPlayer: boolean;
  isMyTurn: boolean;
  phase: string;
  inJail: boolean;
  cash: number;
  buy: { name: string; price: number } | null;
  upgrades: Upgrade[];
  canSkip: boolean;
};

const btn = "min-h-11 rounded-2xl px-4 py-2 text-sm font-semibold active:scale-95 disabled:opacity-50";

export function MonopolyControls({ gameId, isPlayer, isMyTurn, phase, inJail, cash, buy, upgrades, canSkip }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [confirmResign, setConfirmResign] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: string, args: Record<string, unknown> = {}) =>
    start(async () => {
      const { data, error } = await createClient().rpc(fn as "monopoly_roll", { p_game: gameId, ...args } as { p_game: string });
      if (error) setError(error.message.replace(/^.*?: /, ""));
      else {
        setError(undefined);
        const ev = (data as { event?: string } | null)?.event;
        if (ev) void notify("game", ev);
      }
      setConfirmResign(false);
      router.refresh();
    });

  if (!isPlayer) return <p className="text-sm text-neutral-500">You&apos;re watching this game.</p>;

  return (
    <section className="space-y-3 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      {isMyTurn ? (
        <>
          <p className="font-semibold">Your turn · ${cash}</p>
          {phase === "roll" && (
            <div className="flex flex-wrap gap-2">
              <button disabled={pending} onClick={() => run("monopoly_roll")} className={`${btn} flex-1 bg-violet-600 text-white`}>{inJail ? "Roll for doubles" : "Roll the dice"}</button>
              {inJail && <button disabled={pending || cash < 50} onClick={() => run("monopoly_pay_jail")} className={`${btn} bg-white dark:bg-neutral-800`}>Pay $50 to leave</button>}
            </div>
          )}
          {phase === "buy" && buy && (
            <div className="flex gap-2">
              <button disabled={pending || cash < buy.price} onClick={() => run("monopoly_buy", { p_buy: true })} className={`${btn} flex-1 bg-violet-600 text-white`}>Buy {buy.name} · ${buy.price}</button>
              <button disabled={pending} onClick={() => run("monopoly_buy", { p_buy: false })} className={`${btn} bg-white dark:bg-neutral-800`}>Pass</button>
            </div>
          )}
          {phase === "end" && <button disabled={pending} onClick={() => run("monopoly_end_turn")} className={`${btn} w-full bg-violet-600 text-white`}>End turn</button>}
          {phase !== "buy" && upgrades.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-neutral-500">Upgrade a property</p>
              <div className="flex flex-wrap gap-2">
                {upgrades.map((u) => (
                  <button key={u.space} disabled={pending || !u.affordable} onClick={() => run("monopoly_upgrade", { p_space: u.space })} className={`${btn} bg-white dark:bg-neutral-800`}>
                    {u.name} {u.level}→{u.level + 1} · ${u.cost}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">Waiting for your turn. You have ${cash}.</p>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-sm">
        {canSkip && <button disabled={pending} onClick={() => run("monopoly_skip")} className="min-h-11 text-violet-600 underline dark:text-violet-400">Skip the idle player</button>}
        {!confirmResign ? (
          <button onClick={() => setConfirmResign(true)} className="min-h-11 text-neutral-500 underline">Resign</button>
        ) : (
          <button disabled={pending} onClick={() => run("monopoly_resign")} className="min-h-11 text-red-500 underline">Confirm: I resign (you lose your buy-in)</button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    </section>
  );
}
