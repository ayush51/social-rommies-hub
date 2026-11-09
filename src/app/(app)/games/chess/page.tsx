import Link from "next/link";
import { ChessCreateForm } from "@/components/chess-lobby";
import { LiveRefresh } from "@/components/live-refresh";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function ChessHome() {
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: games }, { data: members }] = await Promise.all([
    supabase.from("chess_games").select("id, host_id, white_id, black_id, status, turn, buy_in, result, reason").order("created_at", { ascending: false }).limit(30),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const all = games ?? [];
  const mine = (g: (typeof all)[number]) => g.white_id === me.userId || g.black_id === me.userId || g.host_id === me.userId;
  const open = all.filter((g) => g.status === "lobby");
  const live = all.filter((g) => g.status === "playing");
  const past = all.filter((g) => g.status === "finished").slice(0, 8);

  const row = (g: (typeof all)[number]) => {
    const yourMove = g.status === "playing" && (g.turn === "w" ? g.white_id : g.black_id) === me.userId;
    const pot = g.buy_in ? `${g.buy_in * 2} bingdon pot` : "free";
    const title = g.status === "lobby" ? `${names[g.host_id]} is looking for an opponent` : `${names[g.white_id ?? ""]} vs ${names[g.black_id ?? ""]}`;
    const detail =
      g.status === "lobby" ? (g.host_id === me.userId ? "Your open game" : "Tap to join")
      : g.status === "playing" ? (yourMove ? "Your move" : `${names[(g.turn === "w" ? g.white_id : g.black_id) ?? ""]} to move`)
      : g.result === "draw" ? `Draw (${g.reason})` : `${g.result === "white" ? names[g.white_id ?? ""] : names[g.black_id ?? ""]} won (${g.reason})`;
    return (
      <li key={g.id}>
        <Link href={`/games/chess/${g.id}`} className="block min-h-11 rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-neutral-500">
            <span className={yourMove ? "font-semibold text-violet-600 dark:text-violet-400" : ""}>{detail}</span> · {g.status === "lobby" ? (g.buy_in ? `${g.buy_in} bingdon buy-in` : "free") : pot}
          </p>
        </Link>
      </li>
    );
  };

  return (
    <>
      <LiveRefresh table="chess_games" householdId={me.householdId} />
      <Link href="/games" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Games</Link>
      <h1 className="mb-1 mt-1 text-3xl font-bold tracking-tight">Chess</h1>
      <p className="mb-4 text-sm text-neutral-500">Take your moves whenever, you get a ping when it&apos;s yours. Optional bingdon buy-in.</p>
      <ChessCreateForm />
      {open.length > 0 && (
        <>
          <h2 className="mt-6 font-semibold">Open games</h2>
          <ul className="mt-2 space-y-2">{open.map(row)}</ul>
        </>
      )}
      <h2 className="mt-6 font-semibold">In progress</h2>
      {live.length === 0 && <p className="mt-2 text-sm text-neutral-500">No games right now.</p>}
      <ul className="mt-2 space-y-2">
        {live.filter(mine).map(row)}
        {live.filter((g) => !mine(g)).map(row)}
      </ul>
      {past.length > 0 && (
        <>
          <h2 className="mt-6 font-semibold text-neutral-500">Finished</h2>
          <ul className="mt-2 space-y-2 opacity-80">{past.map(row)}</ul>
        </>
      )}
    </>
  );
}
