"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = { requestId: string; householdId: string; userId: string; voted: boolean; count: number };

export function FeatureVote({ requestId, householdId, userId, voted, count }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <button
      disabled={pending}
      aria-label={voted ? "Remove your vote" : "Vote for this"}
      onClick={() =>
        start(async () => {
          const supabase = createClient();
          const { error } = voted
            ? await supabase.from("feature_votes").delete().match({ request_id: requestId, user_id: userId })
            : await supabase.from("feature_votes").insert({ request_id: requestId, user_id: userId, household_id: householdId });
          setError(!!error);
          router.refresh();
        })
      }
      className={`flex shrink-0 flex-col items-center rounded-2xl px-3 py-2 text-sm active:scale-95 ${
        voted ? "bg-violet-600 text-white" : "bg-white dark:bg-neutral-800"
      } ${error ? "ring-2 ring-red-400" : ""}`}
    >
      <ChevronUp size={16} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
