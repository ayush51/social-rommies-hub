"use client";

import { useState, useTransition } from "react";
import { BedDouble, Beer, Briefcase, Clapperboard, CookingPot, Gamepad2, Sofa, Sparkles, Users, X } from "lucide-react";
import { clearStatus, setStatus } from "@/app/(app)/actions";
import { EXPIRY_OPTIONS, STATUS_PRESETS } from "@/lib/statuses";

const ICONS: Record<string, typeof Sparkles> = {
  in_bed: BedDouble,
  movie: Clapperboard,
  drinking: Beer,
  work: Briefcase,
  gaming: Gamepad2,
  living_room: Sofa,
  cooking: CookingPot,
  hangout: Users,
};

export const StatusIcon = ({ kind, size = 18 }: { kind: string; size?: number }) => {
  const Icon = ICONS[kind] ?? Sparkles;
  return <Icon size={size} />;
};

export function StatusPanel({ current }: { current?: string }) {
  const [hours, setHours] = useState("0");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const apply = (kind: string, label: string) =>
    start(async () => {
      const r = await setStatus({ kind, label, hours });
      setError(r.error);
      if (!r.error && kind === "custom") setCustom("");
    });

  return (
    <section className="mt-6 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">What are you up to?</h2>
        {current && (
          <button onClick={() => start(() => clearStatus())} className="flex items-center gap-1 text-sm text-neutral-500">
            <X size={14} /> Clear
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {STATUS_PRESETS.map((s) => (
          <button
            key={s.kind}
            disabled={pending}
            onClick={() => apply(s.kind, s.label)}
            className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm active:scale-95 disabled:opacity-60 ${
              current === s.label ? "bg-violet-600 text-white" : "bg-white dark:bg-neutral-800"
            }`}
          >
            <StatusIcon kind={s.kind} /> {s.label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) apply("custom", custom.trim());
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={60}
          placeholder="Something else…"
          className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2 text-sm dark:bg-neutral-800"
        />
        <select
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="rounded-2xl bg-white px-2 text-sm dark:bg-neutral-800"
        >
          {EXPIRY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}
