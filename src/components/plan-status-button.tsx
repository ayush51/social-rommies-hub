"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PlanStatusButton({ planId, status }: { planId: string; status: string }) {
  const router = useRouter();
  const cancelled = status === "cancelled";
  return (
    <button
      onClick={async () => {
        await createClient().from("plans").update({ status: cancelled ? "scheduled" : "cancelled" }).eq("id", planId);
        router.refresh();
      }}
      className="text-sm text-neutral-500 underline"
    >
      {cancelled ? "Restore plan" : "Cancel plan"}
    </button>
  );
}
