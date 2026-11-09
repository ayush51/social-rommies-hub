"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildPrompt, type PromptRequest } from "@/lib/feature-prompt";
import { createClient } from "@/lib/supabase/client";

const STATUSES = ["proposed", "approved", "building", "shipped", "rejected"] as const;

type Props = { id: string; status: string; note: string | null; request: PromptRequest };

export function FeatureAdmin({ id, status: initial, note: initialNote, request }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [note, setNote] = useState(initialNote ?? "");
  const [msg, setMsg] = useState<string>();
  const [showPrompt, setShowPrompt] = useState(false);
  const [pending, start] = useTransition();
  const prompt = buildPrompt({ ...request, note: note.trim() || null });

  const save = () =>
    start(async () => {
      const { error } = await createClient().from("feature_requests").update({ status, admin_note: note.trim() || null }).eq("id", id);
      setMsg(error ? "Couldn't save." : "Saved.");
      router.refresh();
    });

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${status === s ? "bg-violet-600 text-white" : "bg-white dark:bg-neutral-800"}`}>{s}</button>
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note to the house (optional)" className="w-full rounded-2xl bg-white px-3 py-2 text-sm dark:bg-neutral-800" />
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">Save</button>
        <button onClick={() => setShowPrompt(!showPrompt)} className="text-sm text-violet-600 underline dark:text-violet-400">{showPrompt ? "Hide" : "Claude Code prompt"}</button>
        {msg && <span className="text-sm text-neutral-500">{msg}</span>}
      </div>
      {showPrompt && <PromptBox text={prompt} />}
    </div>
  );
}

export function PromptBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <textarea readOnly value={text} rows={10} className="w-full rounded-2xl bg-white p-3 font-mono text-xs dark:bg-neutral-800" onFocus={(e) => e.currentTarget.select()} />
      <button
        onClick={async () => {
          try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
        }}
        className="mt-1 rounded-2xl bg-neutral-200 px-4 py-2 text-sm font-semibold dark:bg-neutral-700"
      >
        {copied ? "Copied" : "Copy prompt"}
      </button>
    </div>
  );
}
