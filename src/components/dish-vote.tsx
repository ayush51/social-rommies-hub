"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { ThursdayPoll } from "@/lib/thursday";
import { createClient } from "@/lib/supabase/client";

export function DishVote({ poll }: { poll: ThursdayPoll }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const open = poll.phase === "open";
  const top = Math.max(1, ...poll.dishes.map((d) => d.votes));

  return (
    <div>
      <ul className="space-y-2">
        {poll.dishes.map((d) => {
          const mine = poll.my_vote === d.id;
          const won = poll.winner?.id === d.id;
          return (
            <li key={d.id}>
              <button
                disabled={!open || pending}
                onClick={() =>
                  start(async () => {
                    const { error } = await createClient().rpc("vote_dish", { p_dish: d.id });
                    setError(error ? (error.message.includes("closed") ? "Voting just closed." : "Couldn't save your vote.") : undefined);
                    router.refresh();
                  })
                }
                className={`relative w-full overflow-hidden rounded-2xl px-4 py-3 text-left ${
                  mine ? "ring-2 ring-violet-600" : ""
                } bg-neutral-100 dark:bg-neutral-900 ${open ? "active:scale-[0.98]" : ""}`}
              >
                <span
                  className={`absolute inset-y-0 left-0 ${won ? "bg-violet-400/50" : "bg-violet-200/60 dark:bg-violet-900/50"}`}
                  style={{ width: `${(d.votes / top) * 100}%` }}
                />
                <span className="relative flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium">
                    {d.name}
                    {mine && <Check size={16} className="text-violet-600" />}
                  </span>
                  <span className="tabular-nums text-sm text-neutral-600 dark:text-neutral-400">{d.votes}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
