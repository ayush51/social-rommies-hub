"use server";

import { z } from "zod";
import { applyMove } from "@/lib/chess-engine";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const square = z.string().regex(/^[a-h][1-8]$/);
const schema = z.object({ game: z.string().uuid(), from: square, to: square, promotion: z.enum(["q", "r", "b", "n"]).optional() });

export type MoveActionResult = { ok: true; event: string | null } | { ok: false; error: string };

// The only way to move: chess.js checks the move here, then the database RPC (which needs the server-only secret)
// confirms it is this player's turn and stores the result. The browser never learns the secret.
export async function makeMove(input: z.input<typeof schema>): Promise<MoveActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That move is not valid." };
  const { game: id, from, to, promotion } = parsed.data;
  const secret = process.env.CHESS_SECRET;
  if (!secret) return { ok: false, error: "Chess moves are not configured on the server." };

  const me = await getMe();
  const supabase = await createClient();
  const { data: game } = await supabase.from("chess_games").select("status, turn, white_id, black_id, pgn").eq("id", id).maybeSingle();
  if (!game) return { ok: false, error: "Game not found." };
  if (game.status !== "playing") return { ok: false, error: "This game is not running." };
  if ((game.turn === "w" ? game.white_id : game.black_id) !== me.userId) return { ok: false, error: "It is not your turn." };

  const res = applyMove(game.pgn, { from, to, promotion }, game.turn === "w" ? "w" : "b");
  if (!res.ok) return { ok: false, error: res.error };

  const { data, error } = await supabase.rpc("chess_apply_move", {
    p_secret: secret, p_game: id, p_san: res.san, p_fen: res.fen, p_pgn: res.pgn, p_outcome: res.outcome,
  });
  if (error) return { ok: false, error: error.message.includes("turn") ? "It is not your turn." : "Couldn't save the move, try again." };
  return { ok: true, event: (data as { event?: string } | null)?.event ?? null };
}
