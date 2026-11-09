"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Shown if a page throws while loading. Tapping "Try again" re-renders just that page.
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void createClient().rpc("log_error", { p_path: location.pathname, p_message: `page crashed: ${error.message}${error.digest ? ` (${error.digest})` : ""}`, p_ua: navigator.userAgent });
  }, [error]);
  return (
    <main role="alert" className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">That didn&apos;t load</h1>
      <p className="text-neutral-500">Something hiccuped on our side. Give it another try.</p>
      <button onClick={reset} className="min-h-11 rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white active:scale-95">Try again</button>
      {/* a full reload on purpose: the router may be what is broken */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="inline-flex min-h-11 items-center text-sm text-violet-600 dark:text-violet-400">Back to Home</a>
    </main>
  );
}
