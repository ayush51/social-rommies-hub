"use client";

import { useState, useTransition } from "react";
import { Megaphone } from "lucide-react";
import { rallyHouse } from "@/app/(app)/actions";
import { StatusIcon } from "@/components/status-panel";
import { STATUS_PRESETS } from "@/lib/statuses";

export function RallyPanel() {
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const r = await rallyHouse({ label });
      setMsg(r.error ?? (r.sent ? `Notified ${r.sent} ${r.sent === 1 ? "device" : "devices"}.` : "Sent, but nobody else has notifications turned on yet."));
      if (!r.error) setLabel("");
    });

  return (
    <section className="mt-6 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <h2 className="flex items-center gap-2 font-semibold"><Megaphone size={18} /> Rally the house</h2>
      <p className="mt-1 text-sm text-neutral-500">Send everyone a notification to join something.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS_PRESETS.filter((s) => s.kind !== "in_bed" && s.kind !== "work").map((s) => (
          <button
            key={s.kind}
            onClick={() => setLabel(s.label)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm active:scale-95 ${
              label === s.label ? "bg-violet-600 text-white" : "bg-white dark:bg-neutral-800"
            }`}
          >
            <StatusIcon kind={s.kind} size={14} /> {s.label}
          </button>
        ))}
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={60}
        placeholder="Or type your own"
        className="mt-3 w-full rounded-2xl bg-white px-3 py-2 text-sm dark:bg-neutral-800"
      />
      <button
        onClick={send}
        disabled={pending || !label.trim()}
        className="mt-3 w-full rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Rally the house"}
      </button>
      {msg && <p className="mt-2 text-sm text-neutral-500">{msg}</p>}
    </section>
  );
}
