"use server";

import { z } from "zod";
import { sendPush } from "@/lib/push";

const schema = z.object({ kind: z.enum(["message", "plan", "post", "market", "game"]), ref: z.string().uuid() });

// Fire-and-forget from the client after it creates a message / plan / photo post.
export async function notify(kind: "message" | "plan" | "post" | "market" | "game", ref: string) {
  const parsed = schema.safeParse({ kind, ref });
  if (parsed.success) await sendPush(parsed.data.kind, parsed.data.ref);
}
