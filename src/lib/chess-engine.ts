import { Chess } from "chess.js";

export type Turn = "w" | "b";
export type MoveInput = { from: string; to: string; promotion?: string };
export type Outcome = "none" | "checkmate" | "stalemate" | "draw";
export type MoveResult = { ok: true; san: string; fen: string; pgn: string; outcome: Outcome } | { ok: false; error: string };

// Pure move validation: replays the stored PGN (so repetition and the fifty-move rule see the whole game),
// then applies one move for the side whose turn the database says it is.
export function applyMove(pgn: string, move: MoveInput, turn: Turn): MoveResult {
  const chess = new Chess();
  try {
    if (pgn.trim()) chess.loadPgn(pgn);
  } catch {
    return { ok: false, error: "This game's history could not be loaded." };
  }
  if (chess.isGameOver()) return { ok: false, error: "The game is already over." };
  if (chess.turn() !== turn) return { ok: false, error: "Out of sync with the server, refresh the page." };
  let played;
  try {
    played = chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  } catch {
    return { ok: false, error: "That move is not legal." };
  }
  const outcome: Outcome = chess.isCheckmate() ? "checkmate" : chess.isStalemate() ? "stalemate" : chess.isDraw() ? "draw" : "none";
  return { ok: true, san: played.san, fen: chess.fen(), pgn: chess.pgn(), outcome };
}
