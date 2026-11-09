"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  ["chat", "Group chat"], ["dm", "Direct messages"], ["plans", "Plans"], ["photos", "Daily photos"], ["rally", "Rallies"],
  ["markets", "Predictions"], ["games", "Games"], ["thursday", "Thirsty Thursday"], ["birthdays", "Birthdays"], ["pets", "Pets"], ["chess", "Chess"], ["other", "Everything else"],
] as const;

type Props = { muted: string[]; quietStart: string | null; quietEnd: string | null };

export function NotificationSettings({ muted: initial, quietStart, quietEnd }: Props) {
  const [muted, setMuted] = useState(new Set(initial));
  const [quiet, setQuiet] = useState(!!quietStart);
  const [start, setStart] = useState(quietStart?.slice(0, 5) ?? "22:00");
  const [end, setEnd] = useState(quietEnd?.slice(0, 5) ?? "08:00");
  const [msg, setMsg] = useState<string>();
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const { error } = await createClient().rpc("set_notification_prefs", {
        p_muted: [...muted],
        // the generated types mark these required; the function accepts null (no quiet hours)
        p_quiet_start: (quiet ? start : null) as string,
        p_quiet_end: (quiet ? end : null) as string,
      });
      setMsg(error ? "Couldn't save." : "Saved.");
    });

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-1 gap-1">
        {CATEGORIES.map(([key, label]) => (
          <li key={key}>
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 dark:bg-neutral-900">
              <span className="text-sm">{label}</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-violet-600"
                checked={!muted.has(key)}
                onChange={(e) => setMuted((cur) => { const n = new Set(cur); if (e.target.checked) n.delete(key); else n.add(key); return n; })}
              />
            </label>
          </li>
        ))}
      </ul>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 dark:bg-neutral-900">
        <span className="text-sm">Quiet hours (no pings)</span>
        <input type="checkbox" className="h-5 w-5 accent-violet-600" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} />
      </label>
      {quiet && (
        <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
          <label>From<input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-11 w-full rounded-2xl bg-neutral-100 px-3 font-normal dark:bg-neutral-900" /></label>
          <label>Until<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-11 w-full rounded-2xl bg-neutral-100 px-3 font-normal dark:bg-neutral-900" /></label>
        </div>
      )}
      <button disabled={pending} onClick={save} className="min-h-11 w-full rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-60">Save notification settings</button>
      {msg && <p className="text-sm text-neutral-500">{msg}</p>}
    </div>
  );
}
