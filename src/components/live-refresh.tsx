"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// All LiveRefresh instances on a page share one scheduler, so a burst of changes becomes one refresh,
// and a tap on any in-app link cancels the pending refresh: a refresh that lands mid-navigation can swallow the tap.
let timer: ReturnType<typeof setTimeout> | undefined;
let pausedUntil = 0;
let listening = false;

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
    const supabase = createClient();
    const channel = supabase
      .channel(`refresh:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (Date.now() < pausedUntil || document.visibilityState === "hidden") return;
          startTransition(() => router.refresh());
        }, 600);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, householdId, router]);
  return null;
}
