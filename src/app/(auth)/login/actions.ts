"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loginEmail, ROOMMATES } from "@/lib/roommates";

export type LoginState = { error?: string };

const schema = z.object({
  name: z.enum(ROOMMATES),
  pin: z.string().regex(/^\d{3}$/),
});

export async function signIn(_: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your 3-digit PIN." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginEmail(parsed.data.name),
    password: parsed.data.pin,
  });
  if (error) return { error: "Wrong PIN." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
