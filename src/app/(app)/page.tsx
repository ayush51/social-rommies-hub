import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { SeenAt } from "@/components/relative-time";
import { signedUrls } from "@/lib/photos";
import { nowMs } from "@/lib/time";
import { signOut } from "@/app/(auth)/login/actions";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { RallyPanel } from "@/components/rally-panel";
import { StatusIcon, StatusPanel } from "@/components/status-panel";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const me = await getMe();
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, profiles(display_name, nickname, avatar_url, last_seen_at)");
  const { data: statuses } = await supabase
    .from("statuses")
    .select("user_id, kind, label, expires_at")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  const byUser = new Map(statuses?.map((s) => [s.user_id, s]));
  const mine = byUser.get(me.userId);
  const { data: nextPlans } = await supabase
    .from("plans")
    .select("id, title, starts_at")
    .eq("status", "scheduled")
    .gte("starts_at", new Date(nowMs() - 2 * 3600_000).toISOString())
    .order("starts_at")
    .limit(3);
  const avatars = await signedUrls((members ?? []).map((m) => m.profiles?.avatar_url ?? null), "avatars");
  const { data: balance } = await supabase.rpc("my_wallet");

  return (
    <>
      <LiveRefresh table="statuses" householdId={me.householdId} />
      <h1 className="text-3xl font-bold tracking-tight">{me.householdName}</h1>
      <StatusPanel current={mine?.label} />
      <RallyPanel />
      <section className="mt-6 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Coming up</h2>
          <Link href="/plans" className="text-sm text-violet-600 dark:text-violet-400">All plans</Link>
        </div>
        {nextPlans?.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {nextPlans.map((p) => (
              <li key={p.id}>
                <Link href={`/plans/${p.id}`} className="flex justify-between">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-neutral-500"><LocalTime iso={p.starts_at} /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">Nothing planned yet.</p>
        )}
      </section>
      <Link href="/wallet" className="mt-3 flex items-center justify-between rounded-3xl bg-neutral-100 px-4 py-4 dark:bg-neutral-900">
        <span className="font-semibold">Wallet</span>
        <span className="tabular-nums">{balance ?? 0} Abby Coins</span>
      </Link>
      <h2 className="mt-8 font-semibold">Roommates</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {members?.map((m) => {
          const s = byUser.get(m.user_id);
          return (
            <li key={m.user_id} className="flex items-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
              <Avatar url={m.profiles?.avatar_url ? avatars.get(m.profiles.avatar_url) : null} name={m.profiles?.display_name ?? "?"} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.profiles?.nickname || m.profiles?.display_name}</p>
                <p className="flex items-center gap-1.5 truncate text-sm text-neutral-500">
                  {s ? (
                    <>
                      <StatusIcon kind={s.kind} size={14} /> {s.label}
                    </>
                  ) : (
                    "No status"
                  )}
                </p>
              </div>
              <span className="shrink-0 text-xs text-neutral-500"><SeenAt iso={m.profiles?.last_seen_at ?? null} /></span>
            </li>
          );
        })}
      </ul>
      <div className="mt-8 flex gap-4 text-sm text-neutral-500">
        <Link href="/profile">Edit profile</Link>
        <form action={signOut}><button>Sign out</button></form>
      </div>
    </>
  );
}
