"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const field = "w-full rounded-2xl bg-white px-3 py-3 text-sm dark:bg-neutral-800";

export function FeatureForm({ householdId, userId }: { householdId: string; userId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) return setMsg("Give it a short title.");
    setBusy(true);
    const { error } = await createClient()
      .from("feature_requests")
      .insert({ household_id: householdId, created_by: userId, title: title.trim(), description: description.trim() || null });
    setBusy(false);
    if (error) return setMsg(error.message.includes("slow down") ? "That's enough ideas for today. Try tomorrow." : "Couldn't send that.");
    setTitle("");
    setDescription("");
    setMsg("Sent. Ayush will take a look.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <h2 className="font-semibold">Suggest a feature</h2>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="What should we add?" className={field} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="How should it work? (optional)" className={field} />
      <button disabled={busy} className="rounded-2xl bg-violet-600 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Sending…" : "Send it in"}</button>
      {msg && <p className="text-sm text-neutral-500">{msg}</p>}
    </form>
  );
}
