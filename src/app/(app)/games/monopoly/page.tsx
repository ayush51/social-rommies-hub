import Link from "next/link";
import { CreateGameForm } from "@/components/monopoly-lobby";
import { LiveRefresh } from "@/components/live-refresh";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const LABEL: Record<string, string> = { lobby: "Lobby open", playing: "In progress", finished: "Finished", cancelled: "Cancelled" };

export default async function MonopolyHome() {
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: games }, { data: players }, { data: members }] = await Promise.all([
    supabase.from("monopoly_games").select("id, host_id, status, buy_in, max_players, winner_id, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("monopoly_players").select("game_id, user_id"),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const live = (games ?? []).filter((g) => g.status === "lobby" || g.status === "playing");
  const past = (games ?? []).filter((g) => g.status === "finished").slice(0, 8);

  const row = (g: NonNullable<typeof games>[number]) => {
    const ps = (players ?? []).filter((p) => p.game_id === g.id);
    return (
      <li key={g.id}>
        <Link href={`/games/monopoly/${g.id}`} className="block min-h-11 rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
          <p className="font-semibold">{names[g.host_id]}&apos;s game <span className="font-normal text-neutral-500">· {LABEL[g.status]}</span></p>
          <p className="text-sm text-neutral-500">
            {ps.map((p) => names[p.user_id]).join(", ")} · {g.buy_in ? `${g.buy_in * ps.length} bingdon pot` : "free"}
            {g.winner_id ? ` · winner ${names[g.winner_id]}` : ""}
            {ps.some((p) => p.user_id === me.userId) ? " · you're in" : ""}
          </p>
        </Link>
      </li>
    );
  };

  return (
    <>
      {(["monopoly_games", "monopoly_players"] as const).map((t) => <LiveRefresh key={t} table={t} householdId={me.householdId} />)}
      <Link href="/games" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Games</Link>
      <h1 className="mb-1 mt-1 text-3xl font-bold tracking-tight">Abingdon Street</h1>
      <p className="mb-4 text-sm text-neutral-500">Roll, buy the street, collect rent. Play money is bucks; the buy-in and pot are real bingdons. Take your turns whenever, you get a ping when it&apos;s yours.</p>
      <CreateGameForm />
      <h2 className="mt-6 font-semibold">Open and live</h2>
      {live.length === 0 && <p className="mt-2 text-sm text-neutral-500">No games right now. Open a lobby.</p>}
      <ul className="mt-2 space-y-2">{live.map(row)}</ul>
      {past.length > 0 && (
        <>
          <h2 className="mt-6 font-semibold text-neutral-500">Finished</h2>
          <ul className="mt-2 space-y-2 opacity-80">{past.map(row)}</ul>
        </>
      )}
    </>
  );
}
