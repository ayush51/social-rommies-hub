import Link from "next/link";
import { HouseholdSettings } from "@/components/household-settings";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSettings() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data: h } = await supabase.from("households").select("timezone, daily_reset_time, starting_balance, daily_reward, card_reward, poll_reward").eq("id", me.householdId).single();
  const timezones = Intl.supportedValuesOf("timeZone");
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <div className="mt-4">
        {h && <HouseholdSettings householdId={me.householdId} timezones={timezones.includes(h.timezone) ? timezones : [h.timezone, ...timezones]} values={h} />}
      </div>
      <p className="mt-6 text-sm text-neutral-500">Thirsty Thursday dishes, the cook and the lock time live on <Link href="/thursday" className="text-violet-600 underline dark:text-violet-400">the Thursday page</Link>.</p>
    </>
  );
}
