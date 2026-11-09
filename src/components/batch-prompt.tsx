"use client";

import { useState } from "react";
import { PromptBox } from "@/components/feature-admin";
import { buildBatchPrompt, type PromptRequest } from "@/lib/feature-prompt";

export function BatchPrompt({ approved }: { approved: PromptRequest[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-3xl bg-violet-600 p-4 text-white">
      <p className="font-semibold">{approved.length} approved, ready to build</p>
      <p className="mt-1 text-sm text-violet-100">Paste into Claude Code in the terminal, or run <code>claude &quot;$(node --no-warnings scripts/feature-prompt.ts)&quot;</code>.</p>
      <button disabled={!approved.length} onClick={() => setOpen(!open)} className="mt-3 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-violet-700 disabled:opacity-50">{open ? "Hide prompt" : "Get one prompt for all"}</button>
      {open && <div className="mt-3 text-neutral-900"><PromptBox text={buildBatchPrompt(approved)} /></div>}
    </section>
  );
}
