import { AddRoommate, RoommateRow } from "@/components/roommate-admin";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminRoommates() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: members } = await supabase.from("household_members").select("user_id, role, profiles(display_name)").order("joined_at");
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">People</h1>
      <p className="mt-1 text-sm text-neutral-500">Reset a forgotten login code, change who&apos;s an admin, or add a roommate. Codes are never shown after you set them.</p>
      <ul className="mt-4 space-y-2">
        {(members ?? []).map((m) => <RoommateRow key={m.user_id} id={m.user_id} name={m.profiles?.display_name ?? "?"} role={m.role} />)}
      </ul>
      <div className="mt-6"><AddRoommate /></div>
    </>
  );
}
