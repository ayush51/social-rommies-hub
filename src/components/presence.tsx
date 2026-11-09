"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Marks the signed-in user as seen while the app is visible.
export function Presence() {
  useEffect(() => {
    const supabase = createClient();
    const touch = () => {
      if (document.visibilityState === "visible") void supabase.rpc("touch_last_seen");
    };
    touch();
    const timer = setInterval(touch, 60_000);
    document.addEventListener("visibilitychange", touch);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", touch);
    };
  }, []);
  return null;
}
