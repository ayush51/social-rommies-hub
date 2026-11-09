"use client";

import { nowMs } from "@/lib/time";

export function PetAgo({ iso }: { iso: string }) {
  const mins = Math.max(0, Math.floor((nowMs() - new Date(iso).getTime()) / 60000));
  const text = mins < 2 ? "just now" : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return <span suppressHydrationWarning>{text}</span>;
}
