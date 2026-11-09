"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Sparkles, Star, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ICONS = { badge_star: Star, badge_crown: Crown, spotlight: Sparkles, question_pass: Ticket } as const;

type Props = { code: keyof typeof ICONS; name: string; description: string; price: number; balance: number; owned?: boolean; count?: number };

export function ShopItem({ code, name, description, price, balance, owned, count }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  const Icon = ICONS[code];
  const buy = () =>
    start(async () => {
      const { error } = await createClient().rpc("shop_buy", { p_item: code, p_key: crypto.randomUUID() });
      setMsg(
        !error ? "Bought."
        : error.message.includes("enough") ? "Not enough bingdons."
        : error.message.includes("already") ? "You already have that."
        : "Couldn't buy that.",
      );
      router.refresh();
    });
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
      <Icon size={22} className="shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{name}{count ? <span className="ml-2 text-xs font-normal text-neutral-500">you have {count}</span> : null}</p>
        <p className="text-xs text-neutral-500">{description}</p>
        {msg && <p role="status" className="text-xs text-neutral-600 dark:text-neutral-300">{msg}</p>}
      </div>
      <button
        disabled={pending || owned || balance < price}
        onClick={buy}
        className="min-h-11 shrink-0 rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {owned ? "Owned" : `${price}`}
      </button>
    </li>
  );
}
