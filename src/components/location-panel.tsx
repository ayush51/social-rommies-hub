"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, MapPin, Pause, Play, Square } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import { agoText, distanceKm, DURATIONS, formatDistance, getPosition, isActive, notifyLocationChanged, type Share } from "@/lib/location";
import { nowMs } from "@/lib/time";

export type Sharer = { userId: string; name: string; share: Share };

const btn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold disabled:opacity-50";
const primary = `${btn} bg-violet-600 text-white`;
const subtle = `${btn} bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100`;

function Badge({ precision }: { precision: string }) {
  return (
    <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium dark:bg-neutral-800">{precision === "precise" ? "Precise" : "Approximate"}</span>
  );
}

function StartForm({ initial, label, onDone }: { initial: string; label: string; onDone: () => void }) {
  const [precision, setPrecision] = useState(initial);
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Geolocation is only requested here, from the explicit tap.
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const pos = await getPosition(precision === "precise");
      const { error: e } = await createClient().rpc("location_share", {
        p_lat: pos.coords.latitude,
        p_lng: pos.coords.longitude,
        p_accuracy: Math.round(pos.coords.accuracy),
        p_precision: precision,
        p_minutes: minutes,
      });
      if (e) throw new Error(e.message);
      notifyLocationChanged();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">How exact?</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["approx", "Approximate", "Within about 1 km"],
            ["precise", "Precise", "Within a few meters"],
          ].map(([value, title, hint]) => (
            <button
              key={value}
              type="button"
              aria-pressed={precision === value}
              onClick={() => setPrecision(value)}
              className={`min-h-11 rounded-2xl border-2 px-3 py-2 text-left ${precision === value ? "border-violet-600 bg-violet-50 dark:bg-violet-950" : "border-neutral-200 dark:border-neutral-800"}`}
            >
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-neutral-500">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">
        For how long?
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-2 block h-11 w-full rounded-2xl border border-neutral-300 bg-white px-3 text-base dark:border-neutral-700 dark:bg-neutral-900">
          {DURATIONS.map((d) => (
            <option key={d.minutes} value={d.minutes}>{d.label}</option>
          ))}
        </select>
      </label>
      <button type="button" onClick={start} disabled={busy} className={primary}>
        <MapPin size={16} aria-hidden /> {busy ? "Getting your location…" : label}
      </button>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function LocationPanel({ me, others }: { me: Share | null; others: Sharer[] }) {
  const router = useRouter();
  const [extending, setExtending] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = () => startTransition(() => router.refresh());

  // Housemates' pauses, stops and expiries are not pushed to us (the row becomes invisible to us), so re-read now and then.
  useEffect(() => {
    const poll = () => document.visibilityState === "visible" && refresh();
    const timer = setInterval(poll, 30_000);
    window.addEventListener("location:changed", refresh);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      window.removeEventListener("location:changed", refresh);
      document.removeEventListener("visibilitychange", poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = nowMs();
  const sharing = me && new Date(me.expires_at).getTime() > now ? me : null;
  const active = isActive(sharing, now);

  const run = async (fn: () => PromiseLike<unknown>) => {
    setBusy(true);
    await fn();
    notifyLocationChanged();
    refresh();
    setBusy(false);
  };

  return (
    <>
      <section className="mt-4 rounded-3xl bg-neutral-100 p-5 dark:bg-neutral-900">
        {sharing ? (
          <>
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {active ? "You are sharing" : "Sharing is paused"} <Badge precision={sharing.precision} />
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {active ? "Housemates can see you until " : "Nobody can see you. Ends at "}
              <span suppressHydrationWarning>{new Date(sharing.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => run(() => createClient().rpc("location_pause", { p_paused: active }))} className={subtle}>
                {active ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />} {active ? "Pause" : "Resume"}
              </button>
              <button type="button" disabled={busy} onClick={() => setExtending((v) => !v)} aria-expanded={extending} className={subtle}>Extend</button>
              <button type="button" disabled={busy} onClick={() => run(() => createClient().rpc("location_stop"))} className={subtle}>
                <Square size={16} aria-hidden /> Stop
              </button>
            </div>
            {extending && (
              <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <StartForm initial={sharing.precision} label="Extend sharing" onDone={() => { setExtending(false); refresh(); }} />
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="font-semibold">Start sharing</h2>
            <p className="mb-4 mt-1 text-sm text-neutral-500">Your phone will ask for permission when you tap the button below.</p>
            <StartForm initial="approx" label="Start sharing" onDone={refresh} />
          </>
        )}
      </section>
      <p className="mt-3 text-xs text-neutral-500">Your location only updates while The Couch is open. iPhone web apps can&apos;t track you in the background.</p>

      <h2 className="mt-8 font-semibold">Sharing with you</h2>
      <ul className="mt-2 space-y-2">
        {others.length === 0 && <li className="text-sm text-neutral-500">Nobody is sharing right now.</li>}
        {others.map(({ userId, name, share }) => {
          const away = active && sharing ? distanceKm(sharing, share) : null;
          const approx = sharing?.precision === "approx" || share.precision === "approx";
          return (
            <li key={userId} className="flex items-center gap-3 rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-900">
              <Avatar name={name} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="truncate">{name}</span> <Badge precision={share.precision} />
                </p>
                <p className="text-xs text-neutral-500" suppressHydrationWarning>
                  Updated {agoText(share.updated_at, now)}
                  {away !== null && ` · ${approx && away >= 0.5 ? "about " : ""}${formatDistance(away)}`}
                </p>
              </div>
              <a
                href={`https://maps.apple.com/?ll=${share.lat},${share.lng}&q=${encodeURIComponent(name)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${name} in Maps`}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-violet-600 dark:text-violet-400"
              >
                Open in Maps <ExternalLink size={14} aria-hidden />
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
