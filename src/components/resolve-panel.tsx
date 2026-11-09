"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; label: string };

// Two taps on purpose: choosing an outcome pays out coins and can't be undone.
export function ResolvePanel({ marketId, options, isResolver }: { marketId: string; options: Option[]; isResolver: boolean }) {
  const router = useRouter();
  const [pick, setPick] = useState<Option>();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const run = (fn: () => PromiseLike<{ error: unknown }>) =>
    start(async () => {
      const { error } = await fn();
      setError(error ? "Couldn't settle the market." : undefined);
      router.refresh();
    });
  const supabase = createClient();

  return (
    <section className="rounded-3xl border-2 border-violet-300 p-4 dark:border-violet-800">
      <h2 className="font-semibold">{isResolver ? "You're the resolver" : "Admin: settle this market"}</h2>
      <p className="mt-1 text-sm text-neutral-500">Pick what actually happened. Winners split the pool; this can&apos;t be undone.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.id} onClick={() => { setPick(o); setCancelling(false); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${pick?.id === o.id ? "bg-violet-600 text-white" : "bg-neutral-100 dark:bg-neutral-900"}`}>{o.label}</button>
        ))}
      </div>
      {pick && (
        <button disabled={pending} onClick={() => run(() => supabase.rpc("resolve_market", { p_market: marketId, p_option: pick.id }))} className="mt-3 w-full rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-60">
          Confirm: {pick.label} happened
        </button>
      )}
      <div className="mt-3">
        {!cancelling ? (
          <button onClick={() => { setCancelling(true); setPick(undefined); }} className="text-sm text-neutral-500 underline">Cancel the market instead</button>
        ) : (
          <button disabled={pending} onClick={() => run(() => supabase.rpc("cancel_market", { p_market: marketId }))} className="w-full rounded-2xl bg-neutral-200 py-3 text-sm font-semibold dark:bg-neutral-800">
            Confirm: cancel and refund everyone
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}
