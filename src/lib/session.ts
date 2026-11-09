import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getMe = cache(async () => {
  const supabase = await createClient();
  // Verifies the signed token locally (no auth-server round trip); RLS still enforces everything in the database.
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) redirect("/login");
  const { data: m } = await supabase
    .from("household_members")
    .select("role, household_id, households(name, timezone), profiles(display_name)")
    .eq("user_id", userId)
    .single();
  if (!m) redirect("/login");
  return {
    userId,
    householdId: m.household_id,
    householdName: m.households?.name ?? "",
    timezone: m.households?.timezone ?? "UTC",
    displayName: m.profiles?.display_name ?? "",
    isAdmin: m.role === "admin",
  };
});
