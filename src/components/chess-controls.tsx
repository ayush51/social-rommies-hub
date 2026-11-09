"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/app/(app)/push-actions";
import { createClient } from "@/lib/supabase/client";

const btn = "min-h-11 rounded-2xl px-4 py-2 text-sm font-semibold active:scale-95 disabled:opacity-50";
const quiet = `${btn} bg-white dark:bg-neutral-800`;
const solid = `${btn} bg-violet-600 text-white`;

type Fn = "chess_join" | "chess_cancel" | "chess_resign" | "chess_offer_draw" | "chess_accept_draw" | "chess_decline_draw" | "chess_claim_idle";

function useAction(gameId: string) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: Fn, after?: () => void) =>
    start(async () => {
      const { data, error } = await createClient().rpc(fn, { p_game: gameId });
      if (error) setError(error.message.includes("enough") ? "You don't have enough bingdons for the buy-in." : error.message.replace(/^.*?: /, ""));
      else {
        setError(undefined);
        after?.();
        const ev = (data as { event?: string } | null)?.event;
        if (ev) void notify("event", ev);
      }
      router.refresh();
    });
  return { run, error, pending };
}

export function ChessLobbyActions({ gameId, isHost, buyIn }: { gameId: string; isHost: boolean; buyIn: number }) {
  const { run, error, pending } = useAction(gameId);
  return (
    <section className="space-y-2 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <p className="font-semibold">{isHost ? "Waiting for a roommate to join" : "Open game"}</p>
      <div className="flex flex-wrap gap-2">
        {!isHost && <button disabled={pending} onClick={() => run("chess_join")} className={solid}>Join{buyIn ? ` (${buyIn} bingdons)` : ""}</button>}
        {isHost && <button disabled={pending} onClick={() => run("chess_cancel")} className={quiet}>Cancel lobby{buyIn ? " (refund)" : ""}</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    </section>
  );
}

type Props = { gameId: string; isMyTurn: boolean; drawFromMe: boolean; drawFromThem: boolean; canClaim: boolean };

export function ChessControls({ gameId, drawFromMe, drawFromThem, canClaim }: Props) {
  const { run, error, pending } = useAction(gameId);
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="mt-4 space-y-2">
      {drawFromThem && (
        <div className="rounded-2xl bg-violet-100 p-3 dark:bg-violet-950">
          <p className="text-sm font-semibold">Your opponent offers a draw.</p>
          <div className="mt-2 flex gap-2">
            <button disabled={pending} onClick={() => run("chess_accept_draw")} className={solid}>Accept draw</button>
            <button disabled={pending} onClick={() => run("chess_decline_draw")} className={quiet}>Decline</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!drawFromThem && (
          <button disabled={pending || drawFromMe} onClick={() => run("chess_offer_draw")} className={quiet}>{drawFromMe ? "Draw offered" : "Offer draw"}</button>
        )}
        {!confirm ? (
          <button disabled={pending} onClick={() => setConfirm(true)} className={`${btn} text-neutral-500 underline`}>Resign</button>
        ) : (
          <>
            <button disabled={pending} onClick={() => run("chess_resign", () => setConfirm(false))} className={`${btn} bg-red-600 text-white`}>Yes, resign</button>
            <button disabled={pending} onClick={() => setConfirm(false)} className={quiet}>Keep playing</button>
          </>
        )}
        {canClaim && <button disabled={pending} onClick={() => run("chess_claim_idle")} className={solid}>Claim win (idle 72h)</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    </section>
  );
}
