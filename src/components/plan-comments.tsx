"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import { notifyComment } from "@/lib/notify-comment";
import { createClient } from "@/lib/supabase/client";

type C = { id: string; user_id: string; body: string };
type Props = { planId: string; householdId: string; userId: string; isAdmin: boolean; names: Record<string, string>; comments: C[] };

export function PlanComments({ planId, householdId, userId, isAdmin, names, comments }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const { data, error } = await createClient().from("plan_comments").insert({ plan_id: planId, user_id: userId, household_id: householdId, body }).select("id").single();
    setError(error ? (error.message === "slow down" ? "Slow down a little." : "Comment failed.") : undefined);
    if (data) void notifyComment("plan", data.id);
    router.refresh();
  }

  async function remove(id: string) {
    await createClient().from("plan_comments").delete().eq("id", id);
    router.refresh();
  }

  return (
    <section>
      <h2 className="font-semibold">Comments</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {comments.length === 0 && <li className="text-neutral-500">No comments yet.</li>}
        {comments.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2">
            <span><b>{names[c.user_id]}</b> {c.body}</span>
            {(c.user_id === userId || isAdmin) && (
              <button onClick={() => remove(c.id)} aria-label="Delete comment" className="flex h-11 w-11 shrink-0 items-center justify-center text-neutral-400"><Trash2 size={14} /></button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="Add a comment" className="min-w-0 flex-1 rounded-full bg-neutral-100 px-4 py-2 text-sm dark:bg-neutral-900" />
        <button aria-label="Send comment" className="rounded-full bg-violet-600 p-2 text-white"><Send size={16} /></button>
      </form>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </section>
  );
}
