"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Result = { reward?: number };
const messages: Record<string, string> = {
  "feed limit reached": "You've fed them twice today. Back tomorrow.",
  "treat limit reached": "That's three treats today. Back tomorrow.",
  "insufficient bingdons": "Not enough bingdons for a treat.",
};

// Feed / Treat for one pet, with a small hearts burst (static text when the viewer prefers reduced motion).
export function PetButtons({ petId, name, feedsLeft, treatsLeft }: { petId: string; name: string; feedsLeft: number; treatsLeft: number }) {
  const router = useRouter();
  const [burst, setBurst] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(undefined), 1800);
    return () => clearTimeout(t);
  }, [burst]);

  const run = (kind: "feed" | "treat") =>
    start(async () => {
      const supabase = createClient();
      const { data, error } =
        kind === "feed"
          ? await supabase.rpc("pets_feed", { p_pet: petId })
          : await supabase.rpc("pets_treat", { p_pet: petId, p_key: crypto.randomUUID() });
      if (error) {
        const msg = error.message.replace(/^.*?: /, "");
        setError(messages[msg] ?? msg);
        setBurst(undefined);
      } else {
        const r = (data ?? {}) as Result;
        setError(undefined);
        setBurst(kind === "feed" ? `${name} is fed${r.reward ? `, you earned ${r.reward} bingdons` : ""}` : `${name} loves the treat`);
      }
      router.refresh();
    });

  const btn = "min-h-11 flex-1 rounded-2xl px-3 py-2 text-sm font-semibold active:scale-95 disabled:opacity-50 motion-reduce:active:scale-100";
  return (
    <div>
      <div className="flex gap-2">
        <button disabled={pending || feedsLeft === 0} onClick={() => run("feed")} className={`${btn} bg-violet-600 text-white`}>
          Feed · {feedsLeft} left
        </button>
        <button
          disabled={pending || treatsLeft === 0}
          onClick={() => run("treat")}
          aria-label={`Give ${name} a treat for 3 bingdons, ${treatsLeft} left`}
          className={`${btn} bg-neutral-200 dark:bg-neutral-800`}
        >
          Treat · 3 bingdons · {treatsLeft} left
        </button>
      </div>
      <div className="relative mt-2 min-h-5 text-center text-xs" role="status" aria-live="polite">
        {burst && (
          <>
            <span className="pointer-events-none absolute -top-9 left-0 right-0 flex justify-center gap-3 text-pink-500" aria-hidden>
              {[0, 1, 2].map((i) => (
                <Heart key={i} size={18} fill="currentColor" className="motion-safe:animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </span>
            <span className="font-medium text-pink-600 dark:text-pink-400">{burst}</span>
          </>
        )}
        {!burst && error && <span className="text-red-600 dark:text-red-400">{error}</span>}
        {!burst && !error && feedsLeft === 0 && <span className="text-neutral-500">No feeds left today.</span>}
      </div>
    </div>
  );
}
