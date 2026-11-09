// node --no-warnings scripts/chess-selftest.ts
import assert from "node:assert/strict";
import { applyMove, type MoveResult, type Turn } from "../src/lib/chess-engine.ts";

let pgn = "";
let turn: Turn = "w";
let passed = 0;
const reset = () => { pgn = ""; turn = "w"; };
const mv = (from: string, to: string, promotion?: string): MoveResult => {
  const r = applyMove(pgn, { from, to, promotion }, turn);
  if (r.ok) { pgn = r.pgn; turn = turn === "w" ? "b" : "w"; }
  return r;
};
const play = (...moves: string[]) => { let r: MoveResult | undefined; for (const m of moves) r = mv(m.slice(0, 2), m.slice(2, 4), m[4]); return r as Extract<MoveResult, { ok: true }>; };
const ok = (name: string, fn: () => void) => { reset(); fn(); passed++; console.log("ok  ", name); };

ok("legal opening move", () => {
  const r = mv("e2", "e4");
  assert.ok(r.ok && r.san === "e4" && r.outcome === "none" && r.fen.includes(" b "));
});
ok("illegal moves rejected", () => {
  assert.equal(mv("e2", "e5").ok, false);
  assert.equal(mv("e1", "e2").ok, false);
  assert.equal(mv("a1", "a5").ok, false);
  assert.equal(mv("e4", "e5").ok, false);
  assert.equal(mv("zz", "e4").ok, false);
});
ok("wrong turn rejected", () => {
  assert.equal(applyMove("", { from: "e7", to: "e5" }, "b").ok, false);
  play("e2e4");
  assert.equal(applyMove(pgn, { from: "d2", to: "d4" }, "w").ok, false);
  assert.equal(applyMove(pgn, { from: "d2", to: "d4" }, "b").ok, false);
});
ok("cannot move the opponent's pieces", () => {
  assert.equal(mv("e7", "e5").ok, false);
});
ok("must answer a check", () => {
  play("e2e4", "d7d5", "f1b5");
  assert.equal(mv("a7", "a6").ok, false);
  assert.equal(mv("c7", "c6").ok, true);
});
ok("castling kingside", () => {
  const r = play("e2e4", "e7e5", "g1f3", "g8f6", "f1c4", "f8c5", "e1g1");
  assert.equal(r.san, "O-O");
  assert.ok(r.fen.startsWith("rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1"));
});
ok("cannot castle out of check or through an attacked square", () => {
  const inCheck = '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1"]\n\n';
  assert.equal(applyMove(inCheck, { from: "e1", to: "g1" }, "w").ok, false);
  const through = '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1"]\n\n';
  assert.equal(applyMove(through, { from: "e1", to: "g1" }, "w").ok, false);
  assert.equal(applyMove(through, { from: "e1", to: "c1" }, "w").ok, true);
});
ok("en passant", () => {
  play("e2e4", "a7a6", "e4e5", "d7d5");
  const r = mv("e5", "d6");
  assert.ok(r.ok && r.san === "exd6");
  assert.ok(r.ok && r.fen.split(" ")[0].split("/")[3] === "8");
});
ok("en passant only immediately", () => {
  play("e2e4", "a7a6", "e4e5", "d7d5", "a2a3", "a6a5");
  assert.equal(mv("e5", "d6").ok, false);
});
ok("promotion", () => {
  play("a2a4", "b7b5", "a4b5", "a7a6", "b5a6", "c8b7", "a6b7", "b8c6");
  const r = mv("b7", "a8", "q");
  assert.ok(r.ok && r.san === "bxa8=Q");
});
ok("promotion to a knight; missing promotion rejected", () => {
  play("a2a4", "b7b5", "a4b5", "a7a6", "b5a6", "c8b7", "a6b7", "b8c6");
  assert.equal(mv("b7", "a8").ok, false);
  const r = mv("b7", "a8", "n");
  assert.ok(r.ok && r.san === "bxa8=N");
});
ok("fool's mate is checkmate", () => {
  const r = play("f2f3", "e7e5", "g2g4", "d8h4");
  assert.equal(r.outcome, "checkmate");
  assert.equal(r.san, "Qh4#");
  assert.equal(mv("a2", "a3").ok, false, "no moves after mate");
});
ok("scholar's mate is checkmate", () => {
  const r = play("e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7");
  assert.equal(r.outcome, "checkmate");
  assert.equal(r.san, "Qxf7#");
});
ok("stalemate (Loyd's ten-move game)", () => {
  const r = play("e2e3", "a7a5", "d1h5", "a8a6", "h5a5", "h7h5", "h2h4", "a6h6", "a5c7", "f7f6", "c7d7", "e8f7", "d7b7", "d8d3", "b7b8", "d3h7", "b8c8", "f7g6", "c8e6");
  assert.equal(r.outcome, "stalemate");
});
ok("threefold repetition is a draw", () => {
  const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
  let r = play(...shuffle);
  assert.equal(r.outcome, "none");
  r = play(...shuffle);
  assert.equal(r.outcome, "draw");
});
ok("insufficient material is a draw", () => {
  const start = '[SetUp "1"]\n[FEN "7k/8/8/8/8/8/1p6/K1N5 w - - 0 1"]\n\n';
  const r = applyMove(start, { from: "a1", to: "b2" }, "w");
  assert.ok(r.ok && r.outcome === "draw", JSON.stringify(r));
});
ok("fifty-move rule is a draw", () => {
  const start = '[SetUp "1"]\n[FEN "7k/8/8/8/8/8/8/K6R w - - 99 80"]\n\n';
  const r = applyMove(start, { from: "h1", to: "h2" }, "w");
  assert.ok(r.ok && r.outcome === "draw", JSON.stringify(r));
});
ok("garbage history is rejected, not thrown", () => {
  assert.equal(applyMove("1. e4 e4 e4 zzz", { from: "e2", to: "e4" }, "w").ok, false);
});

console.log(`\n${passed} tests passed`);
