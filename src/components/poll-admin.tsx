"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ThursdayPoll } from "@/lib/thursday";
import { createClient } from "@/lib/supabase/client";

type Dish = { id: string; name: string; active: boolean };
const DAYS = [
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
];
const field = "rounded-2xl bg-white px-3 py-2 text-sm dark:bg-neutral-800";

export function PollAdmin({ householdId, dishes, poll }: { householdId: string; dishes: Dish[]; poll: ThursdayPoll }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [cook, setCook] = useState(poll.cook_name);
  const [dow, setDow] = useState(String(poll.lock_dow));
  const [time, setTime] = useState(poll.lock_time.slice(0, 5));
  const [msg, setMsg] = useState<string>();

  async function addDish(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("dishes").insert({ household_id: householdId, name: name.trim() });
    setMsg(error ? "Couldn't add that (maybe it already exists)." : undefined);
    if (!error) setName("");
    router.refresh();
  }

  async function toggle(d: Dish) {
    await supabase.from("dishes").update({ active: !d.active }).eq("id", d.id);
    router.refresh();
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("households")
      .update({ cook_name: cook.trim() || "Jay", poll_lock_dow: Number(dow), poll_lock_time: time })
      .eq("id", householdId);
    setMsg(error ? "Couldn't save settings." : "Saved.");
    router.refresh();
  }

  return (
    <details className="mt-8 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <summary className="cursor-pointer font-semibold">Admin: dishes and settings</summary>
      <form onSubmit={addDish} className="mt-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Add a dish" className={`${field} min-w-0 flex-1`} />
        <button className="rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white">Add</button>
      </form>
      <ul className="mt-3 space-y-1 text-sm">
        {dishes.map((d) => (
          <li key={d.id} className="flex items-center justify-between">
            <span className={d.active ? "" : "text-neutral-400 line-through"}>{d.name}</span>
            <button onClick={() => toggle(d)} className="text-neutral-500 underline">{d.active ? "Retire" : "Bring back"}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={saveSettings} className="mt-4 grid grid-cols-2 gap-2">
        <label className="col-span-2 text-xs font-semibold">Who&apos;s cooking
          <input value={cook} onChange={(e) => setCook(e.target.value)} maxLength={30} className={`${field} mt-1 w-full font-normal`} />
        </label>
        <label className="text-xs font-semibold">Poll locks
          <select value={dow} onChange={(e) => setDow(e.target.value)} className={`${field} mt-1 w-full font-normal`}>
            {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">At
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${field} mt-1 w-full font-normal`} />
        </label>
        <button className="col-span-2 rounded-2xl bg-violet-600 py-2 text-sm font-semibold text-white">Save settings</button>
      </form>
      {msg && <p className="mt-2 text-sm text-neutral-500">{msg}</p>}
    </details>
  );
}
