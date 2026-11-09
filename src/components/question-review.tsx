"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function QuestionReview({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const act = (approve: boolean) =>
    start(async () => {
      const { error } = await createClient().rpc("review_question", { p_id: id, p_approve: approve });
      setError(!!error);
      router.refresh();
    });
  return (
    <div className="mt-2 flex items-center gap-2">
      <button disabled={pending} onClick={() => act(true)} className="rounded-2xl bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Approve</button>
      <button disabled={pending} onClick={() => act(false)} className="rounded-2xl bg-neutral-200 px-4 py-1.5 text-sm font-semibold dark:bg-neutral-800">Reject</button>
      {error && <span className="text-sm text-red-500">Couldn&apos;t save.</span>}
    </div>
  );
}
