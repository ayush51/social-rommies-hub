import Link from "next/link";
import { NewMarketForm } from "@/components/new-market-form";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function NewMarketPage() {
  const me = await getMe();
  const supabase = await createClient();
  const { data: members } = await supabase.from("household_members").select("user_id, profiles(display_name)");
  return (
    <>
      <Link href="/predictions" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Predictions</Link>
      <h1 className="mb-4 mt-2 text-3xl font-bold tracking-tight">New prediction</h1>
      <NewMarketForm
        meId={me.userId}
        members={(members ?? []).map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? "" }))}
      />
    </>
  );
}
