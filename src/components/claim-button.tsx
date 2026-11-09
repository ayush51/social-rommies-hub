"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ClaimButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const { data, error } = await createClient().rpc("claim_daily_reward");
            setMsg(error ? "Couldn't claim right now." : data ? `+${data} Abby Coins` : "Already claimed today. Back tomorrow.");
            router.refresh();
          })
        }
        className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-violet-700 active:scale-95 disabled:opacity-60"
      >
        Claim daily reward
      </button>
      {msg && <p className="mt-2 text-sm text-violet-100">{msg}</p>}
    </div>
  );
}
