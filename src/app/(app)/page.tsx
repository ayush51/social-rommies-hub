import Link from "next/link";
import { Crown, Star } from "lucide-react";
import { Suspense } from "react";
import { ChessSummary } from "@/components/chess-summary";
import { PetsSummary } from "@/components/pets-summary";
import { Avatar } from "@/components/avatar";
import { SeenAt } from "@/components/relative-time";
import { PastQuestions } from "@/components/past-questions";
import { SuggestQuestion } from "@/components/suggest-question";
import type { CardPast, CardToday } from "@/lib/cards";
import type { ThursdayPoll } from "@/lib/thursday";
import { signedUrls } from "@/lib/photos";
import { nowMs } from "@/lib/time";
import { signOut } from "@/app/(auth)/login/actions";
import { CardsPanel } from "@/components/cards-panel";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { RallyPanel } from "@/components/rally-panel";
import { StatusIcon, StatusPanel } from "@/components/status-panel";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const me = await getMe();
  const supabase = await createClient();
  // Independent reads run together: Home used to wait on ten round trips one after another.
  const nowIso = new Date().toISOString();
  const [
    { data: members },
    { data: statuses },
    { data: nextPlans },
    { data: card },
    { data: pollRaw },
    { data: pastRaw },
    { count: openMarkets },
    { count: posted },
    { data: feedRaw },
  ] = await Promise.all([
    supabase.from("household_members").select("user_id, profiles(display_name, nickname, avatar_url, last_seen_at, dob, badge, spotlight_until)"),
    supabase.from("statuses").select("user_id, kind, label, expires_at").or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    supabase
      .from("plans")
      .select("id, title, starts_at")
      .eq("status", "scheduled")
      .gte("starts_at", new Date(nowMs() - 2 * 3600_000).toISOString())
      .order("starts_at")
      .limit(3),
    supabase.rpc("card_today"),
    supabase.rpc("thursday_poll"),
    supabase.rpc("card_past", { p_days: 7 }),
    supabase.from("markets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("daily_posts").select("id", { count: "exact", head: true }),
    supabase.rpc("activity_feed", { p_limit: 8 }),
  ]);
  const feed = (feedRaw ?? []) as unknown as { at: string; text: string; url: string }[];
  const spotlight = (members ?? []).filter((m) => m.profiles?.spotlight_until && new Date(m.profiles.spotlight_until).getTime() > nowMs());
  const byUser = new Map(statuses?.map((s) => [s.user_id, s]));
  const mine = byUser.get(me.userId);
  const avatars = await signedUrls((members ?? []).map((m) => m.profiles?.avatar_url ?? null), "avatars");
  const todayMd = new Date(nowMs()).toLocaleDateString("en-CA", { timeZone: me.timezone }).slice(5);
  const birthdays = (members ?? []).filter((m) => m.profiles?.dob?.slice(5) === todayMd).map((m) => m.profiles?.display_name);
  const poll = pollRaw as unknown as ThursdayPoll | null;
  const past = (pastRaw ?? []) as unknown as CardPast;

  return (
    <>
      <LiveRefresh table="statuses" householdId={me.householdId} />
      <h1 className="text-3xl font-bold tracking-tight">{me.householdName}</h1>
      {birthdays.length > 0 && (
        <p className="mt-4 rounded-3xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">Birthday today: {birthdays.join(", ")}</p>
      )}
      {spotlight.length > 0 && (
        <section className="mt-4 rounded-3xl bg-violet-600 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-200">In the spotlight</p>
          <ul className="mt-1 space-y-1">
            {spotlight.map((m) => (
              <li key={m.user_id} className="font-semibold">
                {m.profiles?.display_name}
                <span className="ml-2 font-normal text-violet-100">{byUser.get(m.user_id)?.label ?? "No status yet"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <StatusPanel current={mine?.label} />
      <Link href="/daily" className="mt-4 flex items-center justify-between rounded-3xl bg-violet-600 px-4 py-4 text-white">
        <span className="font-semibold">Today&apos;s photos</span>
        <span>{posted ?? 0} of {members?.length ?? 0} posted</span>
      </Link>
      {card && <CardsPanel round={card as unknown as CardToday} />}
      <SuggestQuestion />
      <PastQuestions days={past} />
      {poll && (
        <Link href="/thursday" className="mt-6 flex items-center justify-between gap-3 rounded-3xl bg-neutral-100 px-4 py-4 dark:bg-neutral-900">
          <span className="font-semibold">Thirsty Thursday</span>
          <span className="text-right text-sm text-neutral-500">
            {poll.phase === "open"
              ? `Vote: what should ${poll.cook_name} cook? ${poll.total_votes}/${poll.members}`
              : poll.winner
                ? `${poll.cook_name} is making ${poll.winner.name}`
                : "Poll opens Tuesday"}
          </span>
        </Link>
      )}
      <Link href="/predictions" className="mt-3 flex items-center justify-between rounded-3xl bg-neutral-100 px-4 py-4 dark:bg-neutral-900">
        <span className="font-semibold">Predictions</span>
        <span className="text-sm text-neutral-500">{openMarkets ? `${openMarkets} open` : "Start one"}</span>
      </Link>
      <div className="mt-3 space-y-3">
        <Suspense fallback={null}><PetsSummary /></Suspense>
        <Suspense fallback={null}><ChessSummary /></Suspense>
      </div>
      <RallyPanel />
      {feed.length > 0 && (
        <section className="mt-6 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
          <h2 className="font-semibold">Around the house</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {feed.map((e, i) => (
              <li key={i}>
                <Link href={e.url} className="flex min-h-11 items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{e.text}</span>
                  <span className="shrink-0 text-xs text-neutral-500"><SeenAt iso={e.at} event /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-6 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Coming up</h2>
          <Link href="/plans" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">All plans</Link>
        </div>
        {nextPlans?.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {nextPlans.map((p) => (
              <li key={p.id}>
                <Link href={`/plans/${p.id}`} className="flex min-h-11 items-center justify-between">
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
      <h2 className="mt-8 font-semibold">Roommates</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {members?.map((m) => {
          const s = byUser.get(m.user_id);
          return (
            <li key={m.user_id} className="flex items-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
              <Avatar url={m.profiles?.avatar_url ? avatars.get(m.profiles.avatar_url) : null} name={m.profiles?.display_name ?? "?"} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-semibold">
                  {m.profiles?.nickname || m.profiles?.display_name}
                  {m.profiles?.badge === "crown" && <Crown size={14} className="text-amber-500" aria-label="Crown" />}
                  {m.profiles?.badge === "star" && <Star size={14} className="text-amber-500" aria-label="Gold star" />}
                </p>
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
      <div className="mt-8 flex flex-wrap gap-x-2 text-sm text-neutral-500 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:px-2 [&_button]:min-h-11 [&_button]:px-2">
        <Link href="/location">Location</Link>
        <Link href="/features">Suggest a feature</Link>
        {me.isAdmin && <Link href="/admin" className="font-semibold text-violet-600 dark:text-violet-400">Admin mode</Link>}
        <Link href="/profile">Edit profile</Link>
        <form action={signOut}><button>Sign out</button></form>
      </div>
    </>
  );
}
