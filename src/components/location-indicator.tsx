"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { nowMs } from "@/lib/time";
import { getPosition, isActive, notifyLocationChanged, type Share } from "@/lib/location";

type Own = Pick<Share, "precision" | "updated_at" | "expires_at" | "paused">;

// Mount once in the app layout. Shows a "Sharing your location" pill while the signed-in user has an active share,
// and is the only thing that updates the stored point. It reads geolocation only while the server says sharing is active.
export function LocationIndicator() {
  const [own, setOwn] = useState<Own | null>(null);
  const [busy, setBusy] = useState(false);
  const ownRef = useRef<Own | null>(null);
  const uidRef = useRef<string | null>(null);
  const active = isActive(own, nowMs());

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    const load = async () => {
      if (!uidRef.current) {
        const { data } = await supabase.auth.getSession();
        uidRef.current = data.session?.user.id ?? null;
      }
      if (!uidRef.current) return;
      const { data } = await supabase.from("location_shares").select("precision, updated_at, expires_at, paused").eq("user_id", uidRef.current).maybeSingle();
      if (!alive) return;
      ownRef.current = data;
      setOwn(data);
    };
    const reload = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void load(), 300);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    void load().then(() => {
      if (!alive || !uidRef.current) return;
      channel = supabase
        .channel("location:self")
        .on("postgres_changes", { event: "*", schema: "public", table: "location_shares", filter: `user_id=eq.${uidRef.current}` }, reload)
        .subscribe();
    });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("location:changed", reload);
    return () => {
      alive = false;
      clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("location:changed", reload);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Updater: only runs while the server-confirmed share is active. Stops itself at expiry, pause or stop.
  const expiresAt = own?.expires_at;
  useEffect(() => {
    if (!active || !expiresAt) return;
    const supabase = createClient();
    let running = false;
    const tick = async () => {
      const s = ownRef.current;
      if (running || document.visibilityState !== "visible" || !isActive(s, Date.now()) || Date.now() - new Date(s!.updated_at).getTime() < 55_000) return;
      running = true;
      try {
        const pos = await getPosition(s!.precision === "precise");
        const { data: stored } = await supabase.rpc("location_update", { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: Math.round(pos.coords.accuracy) });
        if (stored && ownRef.current) ownRef.current = { ...ownRef.current, updated_at: new Date().toISOString() };
      } catch {
        // permission revoked or no fix: try again next tick; the server keeps the last point until expiry
      } finally {
        running = false;
      }
    };
    const interval = setInterval(() => void tick(), 15_000);
    const expiry = setTimeout(() => {
      ownRef.current = null;
      setOwn(null);
    }, Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    void tick();
    return () => {
      clearInterval(interval);
      clearTimeout(expiry);
    };
  }, [active, expiresAt]);

  if (!active) return null;

  const stop = async () => {
    setBusy(true);
    await createClient().rpc("location_stop");
    ownRef.current = null;
    setOwn(null);
    setBusy(false);
    notifyLocationChanged();
  };

  return (
    <div className="fixed left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-40 flex -translate-x-1/2 items-center whitespace-nowrap rounded-full bg-violet-600 text-sm font-medium text-white shadow-lg">
      <Link href="/location" className="inline-flex min-h-11 items-center gap-1.5 pl-4 pr-2">
        <MapPin size={16} aria-hidden /> Sharing your location
      </Link>
      <span aria-hidden>·</span>
      <button type="button" onClick={stop} disabled={busy} aria-label="Stop sharing your location" className="min-h-11 min-w-11 rounded-r-full pl-2 pr-4 font-semibold underline-offset-2 hover:underline disabled:opacity-60">
        Stop
      </button>
    </div>
  );
}
