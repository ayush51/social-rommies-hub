"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/app/(app)/push-actions";
import { createClient } from "@/lib/supabase/client";

type Plan = { id: string; title: string; description: string | null; location: string | null; starts_at: string };

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const field = "w-full rounded-2xl bg-white px-3 py-3 dark:bg-neutral-800";

export function PlanForm({ householdId, userId, plan }: { householdId: string; userId: string; plan?: Plan }) {
  const router = useRouter();
  const [title, setTitle] = useState(plan?.title ?? "");
  const [when, setWhen] = useState(plan ? toLocalInput(plan.starts_at) : "");
  const [location, setLocation] = useState(plan?.location ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !when) return setError("Add a title and a time.");
    setBusy(true);
    setError(undefined);
    const fields = {
      title: title.trim(),
      starts_at: new Date(when).toISOString(),
      location: location.trim() || null,
      description: description.trim() || null,
    };
    const supabase = createClient();
    if (plan) {
      const { error } = await supabase.from("plans").update(fields).eq("id", plan.id);
      if (error) setError("Couldn't save changes.");
      else router.refresh();
    } else {
      const { data, error } = await supabase
        .from("plans")
        .insert({ household_id: householdId, created_by: userId, ...fields })
        .select("id")
        .single();
      if (error) setError("Couldn't create the plan.");
      else {
        void notify("plan", data.id);
        router.push(`/plans/${data.id}`);
      }
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="What's the plan?" className={field} />
      <input aria-label="Starts at" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
      <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="Where" className={field} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="Details" className={field} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button disabled={busy} className="rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-60">
        {busy ? "Saving…" : plan ? "Save changes" : "Create plan"}
      </button>
    </form>
  );
}
