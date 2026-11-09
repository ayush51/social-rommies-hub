"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Sends uncaught browser errors to the admin error log (max 3 per page load; the database caps it too).
export function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const send = (message: string) => {
      if (sent++ >= 3) return;
      void createClient().rpc("log_error", { p_path: location.pathname, p_message: message, p_ua: navigator.userAgent });
    };
    const onError = (e: ErrorEvent) => send(e.message || "error");
    const onRejection = (e: PromiseRejectionEvent) => send(String((e.reason as Error | undefined)?.message ?? e.reason));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
