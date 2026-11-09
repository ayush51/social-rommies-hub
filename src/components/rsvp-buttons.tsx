"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const OPTIONS = [
  { value: "in", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Can't" },
] as const;

export function RsvpButtons({ planId, householdId, userId, current }: { planId: string; householdId: string; userId: string; current?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();

  async function pick(response: string) {
    const { error } = await createClient()
      .from("plan_rsvps")
      .upsert({ plan_id: planId, user_id: userId, household_id: householdId, response, updated_at: new Date().toISOString() });
    setError(error ? "Couldn't save your answer." : undefined);
    router.refresh();
  }

  return (
    <div>
      <div className="flex gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => pick(o.value)}
            className={`flex-1 rounded-2xl py-3 text-sm font-semibold active:scale-95 ${
              current === o.value ? "bg-violet-600 text-white" : "bg-neutral-100 dark:bg-neutral-900"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
