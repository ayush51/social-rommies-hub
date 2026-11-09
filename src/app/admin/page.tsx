import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminHome() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ count: proposed }, { count: approved }, { count: pendingQs }] = await Promise.all([
    supabase.from("feature_requests").select("id", { count: "exact", head: true }).eq("status", "proposed"),
    supabase.from("feature_requests").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("card_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const card = "flex items-center justify-between rounded-3xl bg-neutral-100 px-5 py-4 dark:bg-neutral-900";
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
      <div className="mt-4 space-y-3">
        <Link href="/admin/pets" className={card}><span className="font-semibold">Pets</span><span className="text-sm text-neutral-500">Add and edit the house pets</span></Link>
        <Link href="/admin/roommates" className={card}><span className="font-semibold">People</span><span className="text-sm text-neutral-500">Roles, codes, add a roommate</span></Link>
        <Link href="/admin/settings" className={card}><span className="font-semibold">Settings</span><span className="text-sm text-neutral-500">Timezone, rewards</span></Link>
        <Link href="/admin/moderation" className={card}><span className="font-semibold">Moderate</span><span className="text-sm text-neutral-500">Chat, photos, comments</span></Link>
        <Link href="/admin/stats" className={card}><span className="font-semibold">Stats and errors</span><span className="text-sm text-neutral-500">Engagement, error log</span></Link>
        <Link href="/admin/features" className={card}>
          <span className="font-semibold">Feature requests</span>
          <span className="text-sm text-neutral-500">{proposed ?? 0} to review · {approved ?? 0} approved</span>
        </Link>
        <Link href="/admin/questions" className={card}>
          <span className="font-semibold">Suggested questions</span>
          <span className="text-sm text-neutral-500">{pendingQs ?? 0} to review</span>
        </Link>
      </div>
    </>
  );
}
