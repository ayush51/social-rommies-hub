import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getMe = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: m } = await supabase
    .from("household_members")
    .select("role, household_id, households(name), profiles(display_name)")
    .eq("user_id", user.id)
    .single();
  if (!m) redirect("/login");
  return {
    userId: user.id,
    householdId: m.household_id,
    householdName: m.households?.name ?? "",
    displayName: m.profiles?.display_name ?? "",
    isAdmin: m.role === "admin",
  };
});
