"use client";

import { notify } from "@/app/(app)/push-actions";
import { createClient } from "@/lib/supabase/client";

// After posting a comment: ask the database to announce it (it checks you wrote it, it's fresh and not announced yet),
// then fire the push. Fire-and-forget; never blocks or breaks commenting.
export async function notifyComment(kind: "post" | "plan" | "feature", id: string) {
  const { data } = await createClient().rpc("notify_comment", { p_kind: kind, p_id: id });
  if (data) void notify("event", data);
}
