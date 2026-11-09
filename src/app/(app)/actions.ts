"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const statusSchema = z.object({
  kind: z.string().trim().min(1).max(30),
  label: z.string().trim().min(1).max(60),
  hours: z.coerce.number().int().min(0).max(24),
});

export async function setStatus(input: z.input<typeof statusSchema>): Promise<{ error?: string }> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { error: "Pick or type a status." };
  const me = await getMe();
  const supabase = await createClient();
  const { hours, ...rest } = parsed.data;
  const { error } = await supabase.from("statuses").upsert({
    ...rest,
    user_id: me.userId,
    household_id: me.householdId,
    expires_at: hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Couldn't update your status." };
  revalidatePath("/");
  return {};
}

const rallySchema = z.object({ label: z.string().trim().min(1).max(60) });

export async function rallyHouse(input: z.input<typeof rallySchema>): Promise<{ error?: string }> {
  const parsed = rallySchema.safeParse(input);
  if (!parsed.success) return { error: "Pick or type an activity." };
  const me = await getMe();
  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    household_id: me.householdId,
    user_id: me.userId,
    body: `${me.displayName} is rallying the house: ${parsed.data.label}. Who's in?`,
  });
  return error ? { error: "Couldn't send the rally. Try again in a minute." } : {};
}

export async function clearStatus() {
  const me = await getMe();
  const supabase = await createClient();
  await supabase.from("statuses").delete().eq("user_id", me.userId);
  revalidatePath("/");
}
