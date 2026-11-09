import Link from "next/link";
import { notFound } from "next/navigation";
import { ChessBoard } from "@/components/chess-board";
import { ChessControls, ChessLobbyActions } from "@/components/chess-controls";
import { LiveRefresh } from "@/components/live-refresh";
import { getMe } from "@/lib/session";
import { nowMs } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";

const REASON: Record<string, string> = {
  checkmate: "by checkmate", resignation: "by resignation", timeout: "on time (72h idle)", agreement: "by agreement",
  stalemate: "by stalemate", draw: "by repetition, fifty moves or no material",
};

export default async function ChessGame({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: game }, { data: members }] = await Promise.all([
    supabase.from("chess_games").select("*").eq("id", id).maybeSingle(),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  if (!game) notFound();
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? "?"]));
  const myColor = game.white_id === me.userId ? "w" : game.black_id === me.userId ? "b" : null;
  const playing = game.status === "playing";
  const toMove = game.turn === "w" ? game.white_id : game.black_id;
  const isMyTurn = playing && toMove === me.userId;
  const pot = game.buy_in * 2;
  const idle = playing && !!myColor && !isMyTurn && !!game.last_move_at && nowMs() - new Date(game.last_move_at).getTime() >= 72 * 3600_000;

  let status: string;
  if (game.status === "lobby") status = "Waiting for an opponent";
  else if (game.status === "cancelled") status = "Cancelled";
  else if (game.status === "finished") {
    const w = game.result === "white" ? game.white_id : game.result === "black" ? game.black_id : null;
    status = w ? `${names[w]} won ${REASON[game.reason ?? ""] ?? ""}` : `Draw ${REASON[game.reason ?? ""] ?? ""}`;
  } else status = isMyTurn ? "Your move" : `${names[toMove ?? ""] ?? "Opponent"} to move`;

  return (
    <>
      <LiveRefresh table="chess_games" householdId={me.householdId} />
      <Link href="/games/chess" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Chess</Link>
      <h1 className="mb-1 mt-1 text-2xl font-bold tracking-tight">
        {game.white_id && game.black_id ? `${names[game.white_id]} vs ${names[game.black_id]}` : `${names[game.host_id]}'s game`}
      </h1>
      <p className="mb-3 text-sm text-neutral-500">
        <span className={`font-semibold ${isMyTurn ? "text-violet-600 dark:text-violet-400" : "text-neutral-900 dark:text-neutral-100"}`} aria-live="polite">{status}</span>
        {" · "}{game.buy_in ? `${pot} bingdon pot` : "free game"}
        {game.white_id && game.black_id ? ` · white ${names[game.white_id]}, black ${names[game.black_id]}` : ""}
      </p>

      {game.status === "lobby" ? (
        <ChessLobbyActions gameId={id} isHost={game.host_id === me.userId} buyIn={game.buy_in} />
      ) : game.status === "cancelled" ? null : (
        <>
          <ChessBoard gameId={id} pgn={game.pgn} myColor={myColor} canMove={isMyTurn} over={!playing} />
          {playing && myColor && (
            <ChessControls
              gameId={id}
              isMyTurn={isMyTurn}
              drawFromMe={game.draw_offered_by === me.userId}
              drawFromThem={!!game.draw_offered_by && game.draw_offered_by !== me.userId}
              canClaim={idle}
            />
          )}
        </>
      )}
    </>
  );
}
