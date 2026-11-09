"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { CardToday } from "@/lib/cards";
import { createClient } from "@/lib/supabase/client";

export function CardsPanel({ round }: { round: CardToday }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const top = Math.max(1, ...round.options.map((o) => o.votes ?? 0));

  return (
    <section className="mt-6 rounded-3xl bg-neutral-900 p-5 text-white dark:bg-neutral-800">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Daily card</p>
      <p className="mt-2 text-xl font-bold leading-snug">{round.prompt}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {round.options.map((o) => {
          const mine = round.my_pick === o.id;
          return (
            <button
              key={o.id}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const { error } = await createClient().rpc("pick_card", { p_pick: o.id });
                  setError(error ? "Couldn't save your pick. Try again." : undefined);
                  router.refresh();
                })
              }
              className={`relative overflow-hidden rounded-2xl px-4 py-3 text-left text-sm font-semibold active:scale-95 ${
                mine ? "ring-2 ring-violet-400" : ""
              } bg-white/10`}
            >
              {round.voted && (
                <span className="absolute inset-y-0 left-0 bg-violet-500/50" style={{ width: `${((o.votes ?? 0) / top) * 100}%` }} />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {o.name}
                  {mine && <Check size={14} />}
                </span>
                {round.voted && <span className="tabular-nums text-neutral-300">{o.votes}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        {round.voted
          ? `${round.voted_count} of ${round.members} voted. Tap another name to change your pick.`
          : "Vote to see everyone's picks. Voting earns 5 Abby Coins."}
      </p>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </section>
  );
}
