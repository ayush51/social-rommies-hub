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

type Pick = { kind: string; label: string };

export function StatusPanel({ current }: { current?: string }) {
  const [picked, setPicked] = useState<Pick>();
  const [custom, setCustom] = useState("");
  const [hours, setHours] = useState("0");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const selection: Pick | undefined = custom.trim() ? { kind: "custom", label: custom.trim() } : picked;

  const submit = () => {
    if (!selection) return;
    start(async () => {
      const r = await setStatus({ ...selection, hours });
      setError(r.error);
      if (!r.error) {
        setPicked(undefined);
        setCustom("");
      }
    });
  };

  return (
    <section className="mt-6 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">What are you up to?</h2>
        {current && (
          <button onClick={() => start(() => clearStatus())} className="flex min-h-11 items-center gap-1 text-sm text-neutral-500">
            <X size={14} /> Clear
          </button>
        )}
      </div>
      {current && <p className="mt-1 text-sm text-neutral-500">Right now: {current}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {STATUS_PRESETS.map((s) => {
          const active = !custom.trim() && picked?.kind === s.kind;
          return (
            <button
              key={s.kind}
              onClick={() => {
                setCustom("");
                setPicked(active ? undefined : { kind: s.kind, label: s.label });
              }}
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm active:scale-95 ${
                active ? "bg-violet-600 text-white" : "bg-white dark:bg-neutral-800"
              }`}
            >
              <StatusIcon kind={s.kind} /> {s.label}
            </button>
          );
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-3 flex flex-col gap-2"
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={60}
          placeholder="Something else…"
          className="min-w-0 rounded-2xl bg-white px-3 py-2 text-sm dark:bg-neutral-800"
        />
        <div className="flex gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            aria-label="Expires"
            className="h-11 rounded-2xl bg-white px-3 text-sm dark:bg-neutral-800"
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            disabled={pending || !selection}
            className="flex-1 rounded-2xl bg-violet-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : selection ? `Set status: ${selection.label}` : "Set status"}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}
