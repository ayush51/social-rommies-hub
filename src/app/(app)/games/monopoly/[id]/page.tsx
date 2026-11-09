import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { MonopolyBoard } from "@/components/monopoly-board";
import { MonopolyControls } from "@/components/monopoly-controls";
import { LobbyActions } from "@/components/monopoly-lobby";
import { GROUP_COLORS, SEAT_COLORS, type Space } from "@/lib/monopoly";
import { getMe } from "@/lib/session";
import { nowMs } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";

export default async function MonopolyGame({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  const supabase = await createClient();
  const { data: game } = await supabase.from("monopoly_games").select("*").eq("id", id).maybeSingle();
  if (!game) notFound();
  const [{ data: rawPlayers }, { data: props }, { data: events }, { data: spaces }] = await Promise.all([
    supabase.from("monopoly_players").select("user_id, seat, cash, position, in_jail, bankrupt, profiles(display_name)").eq("game_id", id).order("seat"),
    supabase.from("monopoly_props").select("space, owner_id, level").eq("game_id", id),
    supabase.from("monopoly_events").select("id, text, created_at").eq("game_id", id).order("seq", { ascending: false }).limit(25),
    supabase.from("monopoly_spaces").select("*").order("idx"),
  ]);
  const board = (spaces ?? []) as Space[];
  const players = (rawPlayers ?? []).map((p) => ({ ...p, name: p.profiles?.display_name ?? "?" }));
  const mine = players.find((p) => p.user_id === me.userId);
  const current = players.find((p) => p.seat === game.current_seat);
  const playing = game.status === "playing";
  const isMyTurn = playing && !!mine && !mine.bankrupt && mine.seat === game.current_seat;
  const myProps = (props ?? []).filter((p) => p.owner_id === me.userId);

  const here = mine ? board[mine.position] : undefined;
  const buy = isMyTurn && game.turn_phase === "buy" && here?.price ? { name: here.name, price: here.price } : null;
  const upgrades = isMyTurn
    ? myProps
        .map((p) => ({ p, s: board[p.space] }))
        .filter(({ p, s }) => {
          if (s.kind !== "property" || p.level >= 3) return false;
          const set = board.filter((x) => x.color === s.color);
          if (!set.every((x) => myProps.some((m) => m.space === x.idx))) return false;
          return p.level <= Math.min(...set.map((x) => myProps.find((m) => m.space === x.idx)!.level));
        })
        .map(({ p, s }) => ({ space: s.idx, name: s.name, level: p.level, cost: s.upgrade_cost ?? 0, affordable: (mine?.cash ?? 0) >= (s.upgrade_cost ?? 0) }))
    : [];
  const canSkip = playing && !!mine && !mine.bankrupt && !isMyTurn && !!game.turn_started_at && nowMs() - new Date(game.turn_started_at).getTime() > 24 * 3600_000;

  const statusText = game.status === "lobby" ? "Waiting for players" : game.status === "cancelled" ? "Cancelled" : game.status === "finished" ? `${players.find((p) => p.user_id === game.winner_id)?.name ?? "Someone"} won` : "";
  const pot = game.buy_in * players.length;

  return (
    <>
      {(["monopoly_games", "monopoly_players", "monopoly_props", "monopoly_events"] as const).map((t) => <LiveRefresh key={t} table={t} householdId={me.householdId} />)}
      <Link href="/games/monopoly" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Abingdon Street</Link>
      <h1 className="mb-3 mt-1 text-2xl font-bold tracking-tight">
        {pot > 0 ? `${pot} bingdon pot` : "Free game"}
        <span className="ml-2 text-sm font-normal text-neutral-500">{game.status === "playing" ? `turn ${game.turn_no}` : game.status}</span>
      </h1>

      <MonopolyBoard
        spaces={board}
        players={players.map((p) => ({ user_id: p.user_id, seat: p.seat, name: p.name, position: p.position, bankrupt: p.bankrupt }))}
        props={props ?? []}
        dice={game.last_dice}
        turnName={playing ? current?.name ?? null : null}
        statusText={statusText}
      />

      <div className="mt-4 space-y-4">
        {game.status === "lobby" && (
          <LobbyActions gameId={id} isMember={!!mine} isHost={game.host_id === me.userId} count={players.length} max={game.max_players} buyIn={game.buy_in} />
        )}
        {playing && (
          <MonopolyControls gameId={id} isPlayer={!!mine && !mine.bankrupt} isMyTurn={isMyTurn} phase={game.turn_phase} inJail={!!mine?.in_jail} cash={mine?.cash ?? 0} buy={buy} upgrades={upgrades} canSkip={canSkip} />
        )}
      </div>

      <h2 className="mt-6 font-semibold">Players</h2>
      <ul className="mt-2 space-y-1">
        {players.map((p) => (
          <li key={p.user_id} className="flex min-h-11 items-center gap-3 rounded-2xl bg-neutral-100 px-4 py-2 dark:bg-neutral-900">
            <span className="block h-3 w-3 shrink-0 rounded-full" style={{ background: SEAT_COLORS[(p.seat - 1) % 6] }} />
            <span className={`flex-1 font-medium ${p.bankrupt ? "text-neutral-400 line-through" : ""}`}>
              {p.name}{p.user_id === me.userId ? " (you)" : ""}{playing && p.seat === game.current_seat ? " · rolling" : ""}
            </span>
            <span className="text-sm tabular-nums text-neutral-500">{p.bankrupt ? "out" : `$${p.cash}${p.in_jail ? " · couch" : ""}`}</span>
          </li>
        ))}
      </ul>

      {(props ?? []).length > 0 && (
        <>
          <h2 className="mt-6 font-semibold">Properties</h2>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-sm">
            {(props ?? []).map((p) => {
              const s = board[p.space];
              const owner = players.find((x) => x.user_id === p.owner_id);
              return (
                <li key={p.space} className="flex items-center gap-2 rounded-xl bg-neutral-100 px-2 py-1.5 dark:bg-neutral-900">
                  <span className="block h-3 w-1.5 shrink-0 rounded-sm" style={{ background: s.color ? GROUP_COLORS[s.color] : "#9ca3af" }} />
                  <span className="min-w-0 flex-1 truncate">{s.name}{p.level ? ` +${p.level}` : ""}</span>
                  <span className="text-xs text-neutral-500">{owner?.name}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2 className="mt-6 font-semibold">What happened</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {(events ?? []).map((e) => <li key={e.id} className="text-neutral-700 dark:text-neutral-300">{e.text}</li>)}
      </ul>
    </>
  );
}
