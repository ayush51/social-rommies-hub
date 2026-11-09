import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { LocationPanel, type Sharer } from "@/components/location-panel";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function LocationPage() {
  const me = await getMe();
  const supabase = await createClient();
  // RLS returns my own row plus only the housemates' shares that are active (not paused, not expired).
  const [{ data: shares }, { data: members }] = await Promise.all([
    supabase.from("location_shares").select("user_id, precision, lat, lng, updated_at, expires_at, paused"),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? "Housemate"]));
  const mine = shares?.find((s) => s.user_id === me.userId) ?? null;
  const others: Sharer[] = (shares ?? []).filter((s) => s.user_id !== me.userId).map((s) => ({ userId: s.user_id, name: names[s.user_id], share: s }));

  return (
    <>
      <LiveRefresh table="location_shares" householdId={me.householdId} />
      <Link href="/" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Home</Link>
      <h1 className="mb-2 mt-2 text-3xl font-bold tracking-tight">Location</h1>
      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
        <li>Sharing is off unless you turn it on.</li>
        <li>Only your housemates can see it.</li>
        <li>It stops by itself when your timer ends.</li>
        <li>You can pause or stop any time. Only your latest spot is kept.</li>
      </ul>
      <LocationPanel me={mine} others={others} />
    </>
  );
}
