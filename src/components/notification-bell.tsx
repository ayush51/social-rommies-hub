"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

const b64ToBytes = (s: string) => {
  const raw = atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function NotificationBell() {
  const [state, setState] = useState<State>("loading");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState(ios ? "install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      setState((await reg?.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setError(undefined);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        }));
      const json = sub.toJSON();
      const { error } = await createClient().rpc("save_subscription", {
        p_endpoint: sub.endpoint,
        p_p256dh: json.keys!.p256dh,
        p_auth: json.keys!.auth,
      });
      if (error) throw error;
      setState("on");
    } catch {
      setError("Couldn't turn notifications on. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await createClient().rpc("drop_subscriptions", { p_endpoints: [sub.endpoint] });
      await sub.unsubscribe();
    }
    setState("off");
    setBusy(false);
  }

  const Icon = state === "on" ? BellRing : state === "denied" ? BellOff : Bell;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Notifications" className="relative flex h-11 w-11 items-center justify-center rounded-full active:scale-95">
        <Icon size={22} className={state === "on" ? "text-violet-600 dark:text-violet-400" : "text-neutral-500"} />
        {state === "off" && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet-600" />}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded-3xl bg-white p-4 text-sm shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          <p className="font-semibold">Notifications</p>
          {state === "on" && (
            <>
              <p className="mt-1 text-neutral-500">On for this device: new messages, plans and daily photos.</p>
              <button onClick={disable} disabled={busy} className="mt-3 rounded-2xl bg-neutral-100 px-4 py-3 font-semibold dark:bg-neutral-800">Turn off</button>
            </>
          )}
          {state === "off" && (
            <>
              <p className="mt-1 text-neutral-500">Get pinged for messages, plans and daily photos.</p>
              <button onClick={enable} disabled={busy} className="mt-3 rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
                {busy ? "Turning on…" : "Turn on notifications"}
              </button>
            </>
          )}
          {state === "install" && (
            <p className="mt-1 text-neutral-500">On iPhone, tap Share, then Add to Home Screen, and open The Couch from your Home Screen. Then come back to this bell.</p>
          )}
          {state === "denied" && <p className="mt-1 text-neutral-500">Notifications are blocked. Allow them for this app in your phone&apos;s Settings.</p>}
          {state === "unsupported" && <p className="mt-1 text-neutral-500">This browser doesn&apos;t support notifications.</p>}
          {state === "loading" && <p className="mt-1 text-neutral-500">Checking…</p>}
          {error && <p className="mt-2 text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
