"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// One shared scheduler for every LiveRefresh on a page:
//  - a burst of realtime changes becomes one refresh,
//  - a tap on an in-app link cancels the pending refresh and pauses refreshing while that navigation is in flight
//    (a refresh that lands mid-navigation can swallow the tap),
//  - arriving on a page (possibly shown from the client page cache) triggers one quiet revalidation once the navigation is done.
let timer: ReturnType<typeof setTimeout> | undefined;
let pausedUntil = 0;
let listening = false;
let firstLoadDone = false;

function refreshSoon(refresh: () => void, delay: number) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (Date.now() < pausedUntil || document.visibilityState === "hidden") return;
    startTransition(refresh);
  }, delay);
}

function listenForTaps() {
  if (listening) return;
  listening = true;
  const onTap = (e: Event) => {
    const link = (e.target as Element | null)?.closest?.("a[href]");
    if (link?.getAttribute("href")?.startsWith("/")) {
      pausedUntil = Date.now() + 5000;
      clearTimeout(timer);
    }
  };
  document.addEventListener("pointerdown", onTap, true);
  document.addEventListener("click", onTap, true);
}

// Re-renders the server component tree when rows in `table` change for this household.
export function LiveRefresh({ table, householdId }: { table: string; householdId: string }) {
  const router = useRouter();
  useEffect(() => {
    listenForTaps();
    // Mounting means the navigation that brought us here is finished, so lift its pause. The first mount of the app is a
    // fresh server render and needs nothing; later mounts may be prefetched pages, so revalidate once.
    pausedUntil = 0;
    if (firstLoadDone) refreshSoon(() => router.refresh(), 150);
    firstLoadDone = true;
    const supabase = createClient();
    const channel = supabase
      .channel(`refresh:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` }, () => refreshSoon(() => router.refresh(), 600))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, householdId, router]);
  return null;
}
