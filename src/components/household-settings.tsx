"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  householdId: string;
  timezones: string[];
  values: { timezone: string; daily_reset_time: string; starting_balance: number; daily_reward: number; card_reward: number; poll_reward: number };
};

const field = "mt-1 h-11 w-full rounded-2xl bg-neutral-100 px-3 text-sm font-normal dark:bg-neutral-900";

export function HouseholdSettings({ householdId, timezones, values }: Props) {
  const router = useRouter();
  const [v, setV] = useState({ ...values, daily_reset_time: values.daily_reset_time.slice(0, 5) });
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();
  const num = (k: "starting_balance" | "daily_reward" | "card_reward" | "poll_reward", max: number) => (
    <input type="number" min={0} max={max} value={v[k]} onChange={(e) => setV({ ...v, [k]: Math.max(0, Math.min(max, Number(e.target.value) || 0)) })} className={field} />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const { error } = await createClient().from("households").update(v).eq("id", householdId);
          setMsg(error ? { ok: false, text: error.message.includes("timezone") ? "That timezone isn't valid." : error.message.includes("reset") ? "The reset time must be between midnight and noon." : "Couldn't save." } : { ok: true, text: "Saved." });
          router.refresh();
        });
      }}
      className="space-y-4"
    >
      <section className="rounded-3xl bg-white p-4 ring-1 ring-neutral-200 dark:bg-transparent dark:ring-neutral-800">
        <h2 className="font-semibold">Day boundaries</h2>
        <label className="mt-3 block text-xs font-semibold">Household timezone
          <select value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} className={field}>
            {timezones.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-xs font-semibold">Daily reset time (photos, card, rewards roll over)
          <input type="time" max="12:00" value={v.daily_reset_time} onChange={(e) => setV({ ...v, daily_reset_time: e.target.value })} className={field} />
        </label>
      </section>
      <section className="rounded-3xl bg-white p-4 ring-1 ring-neutral-200 dark:bg-transparent dark:ring-neutral-800">
        <h2 className="font-semibold">Bingdon rewards</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold">
          <label>Starting balance (new wallets){num("starting_balance", 1000)}</label>
          <label>Daily reward{num("daily_reward", 500)}</label>
          <label>Daily card vote{num("card_reward", 100)}</label>
          <label>Thursday poll vote{num("poll_reward", 100)}</label>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Set a reward to 0 to switch it off. Existing wallets aren&apos;t changed.</p>
      </section>
      <button disabled={pending} className="min-h-11 w-full rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-60">Save settings</button>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
    </form>
  );
}
