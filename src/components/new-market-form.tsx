"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { notify } from "@/app/(app)/push-actions";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; name: string };
const field = "w-full rounded-2xl bg-white px-3 py-3 text-sm dark:bg-neutral-800";

const toInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// Quick closing-time choices, computed in the viewer's timezone.
const presets = [
  { label: "Tonight", at: () => { const d = new Date(); d.setHours(23, 0, 0, 0); return d.getTime() < Date.now() + 3600_000 ? new Date(Date.now() + 3 * 3600_000) : d; } },
  { label: "Tomorrow", at: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(21, 0, 0, 0); return d; } },
  { label: "End of week", at: () => { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); d.setHours(21, 0, 0, 0); return d; } },
  { label: "In a week", at: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(21, 0, 0, 0); return d; } },
];

export function NewMarketForm({ members, meId }: { members: Member[]; meId: string }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["Yes", "No"]);
  const [closes, setCloses] = useState("");
  const [resolver, setResolver] = useState(meId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !closes) return setError("Add a question and a closing time.");
    setBusy(true);
    setError(undefined);
    const { data, error } = await createClient().rpc("create_market", {
      p_question: question,
      p_description: description,
      p_options: options,
      p_closes_at: new Date(closes).toISOString(),
      p_resolver: resolver,
    });
    if (error) {
      setError(
        error.message.includes("slow down") ? "You've started a lot of markets. Try again later."
        : error.message.includes("duplicate") ? "Options need different names."
        : error.message.includes("closing") ? "Pick a closing time within the next 60 days."
        : "Couldn't create the market.",
      );
      setBusy(false);
      return;
    }
    void notify("market", data);
    router.push(`/predictions/${data}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={140} placeholder="Will Jesse hang out with us this week?" className={field} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} placeholder="Details (optional): what counts?" className={field} />

      <div>
        <p className="mb-1 text-xs font-semibold">Options</p>
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label={`Option ${i + 1}`} value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} maxLength={40} className={field} />
              {options.length > 2 && (
                <button type="button" aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="flex h-11 w-11 items-center justify-center text-neutral-500"><X size={16} /></button>
              )}
            </div>
          ))}
        </div>
        {options.length < 4 && (
          <button type="button" onClick={() => setOptions([...options, ""])} className="mt-2 flex min-h-11 items-center gap-1 text-sm text-violet-600 dark:text-violet-400"><Plus size={14} /> Add option</button>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold">Betting closes</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.label} type="button" onClick={() => setCloses(toInput(p.at()))} className="min-h-11 rounded-full bg-neutral-100 px-4 py-2.5 text-sm dark:bg-neutral-900">{p.label}</button>
          ))}
        </div>
        <input aria-label="Betting closes" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} className={field} />
      </div>

      <label className="text-xs font-semibold">
        Resolver (decides the outcome, can&apos;t bet)
        <select value={resolver} onChange={(e) => setResolver(e.target.value)} className={`${field} h-11 mt-1 font-normal`}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.id === meId ? " (me)" : ""}</option>)}
        </select>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <button disabled={busy} className="rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Creating…" : "Start the market"}</button>
    </form>
  );
}
