"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import { notify } from "@/app/(app)/push-actions";
import { makeMove } from "@/app/(app)/games/chess/actions";

// Solid glyphs for both sides (coloured with CSS); U+FE0E keeps iOS from swapping in emoji-style pieces.
const GLYPH: Record<PieceSymbol, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const NAME: Record<PieceSymbol, string> = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const FILES = "abcdefgh";
const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const Piece = ({ type, color, size = "text-[2.1rem]" }: { type: PieceSymbol; color: "w" | "b"; size?: string }) => (
  <span
    aria-hidden
    className={`${size} leading-none ${color === "w" ? "text-white [text-shadow:0_0_2px_#1e1b2e,0_0_2px_#1e1b2e,0_1px_1px_#1e1b2e]" : "text-[#1e1b2e] [text-shadow:0_0_1px_#fff]"}`}
  >
    {GLYPH[type]}&#xFE0E;
  </span>
);

type Props = { gameId: string; pgn: string; myColor: "w" | "b" | null; canMove: boolean; over: boolean };

export function ChessBoard({ gameId, pgn, myColor, canMove, over }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const { chess, history } = useMemo(() => {
    const c = new Chess();
    if (pgn.trim()) c.loadPgn(pgn);
    return { chess: c, history: c.history({ verbose: true }) };
  }, [pgn]);

  const last = history.at(-1);
  const checkSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    for (const row of chess.board()) for (const sq of row) if (sq && sq.type === "k" && sq.color === chess.turn()) return sq.square;
    return null;
  }, [chess]);
  const targets = useMemo(() => {
    const m = new Map<string, Move[]>();
    if (selected) for (const mv of chess.moves({ square: selected, verbose: true })) m.set(mv.to, [...(m.get(mv.to) ?? []), mv]);
    return m;
  }, [chess, selected]);

  const flipped = myColor === "b";
  const files = flipped ? [...FILES].reverse() : [...FILES];
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];

  const captured = { w: [] as PieceSymbol[], b: [] as PieceSymbol[] }; // pieces each colour has lost
  for (const m of history) if (m.captured) captured[m.color === "w" ? "b" : "w"].push(m.captured);
  const lead = captured.b.reduce((s, p) => s + VALUE[p], 0) - captured.w.reduce((s, p) => s + VALUE[p], 0);
  const sortLost = (a: PieceSymbol[]) => [...a].sort((x, y) => VALUE[y] - VALUE[x]);

  function submit(from: Square, to: Square, promotion?: string) {
    setPromo(null);
    setSelected(null);
    start(async () => {
      const r = await makeMove({ game: gameId, from, to, promotion: promotion as "q" | "r" | "b" | "n" | undefined });
      if (!r.ok) setError(r.error);
      else {
        setError(undefined);
        if (r.event) void notify("event", r.event);
      }
      router.refresh();
    });
  }

  function tap(sq: Square) {
    if (!canMove || pending || over) return;
    setError(undefined);
    const hit = targets.get(sq);
    if (selected && hit) {
      if (hit[0].isPromotion()) setPromo({ from: selected, to: sq });
      else submit(selected, sq);
      return;
    }
    const piece = chess.get(sq);
    setSelected(piece && piece.color === myColor && sq !== selected ? sq : null);
  }

  const lostRow = (who: "w" | "b") => (
    <p className="flex min-h-6 items-center gap-0.5 text-sm text-neutral-500" aria-label={`${who === "w" ? "White" : "Black"} pieces captured`}>
      {sortLost(captured[who]).map((t, i) => <Piece key={i} type={t} color={who} size="text-base" />)}
      {(who === "b" ? lead > 0 : lead < 0) && <span className="ml-1 text-xs font-semibold">+{Math.abs(lead)}</span>}
    </p>
  );
  const bottom = flipped ? "b" : "w";

  return (
    <div>
      {lostRow(bottom === "w" ? "b" : "w")}
      <div className="relative" role="group" aria-label="Chess board">
        <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl">
          {ranks.flatMap((rank) =>
            files.map((file) => {
              const sq = `${file}${rank}` as Square;
              const dark = (FILES.indexOf(file) + rank) % 2 === 1;
              const piece = chess.get(sq);
              const isTarget = targets.has(sq);
              const isLast = last && (last.from === sq || last.to === sq);
              const label = `${sq}, ${piece ? `${piece.color === "w" ? "white" : "black"} ${NAME[piece.type]}` : "empty"}${sq === checkSquare ? ", in check" : ""}${isTarget ? ", legal move" : ""}${sq === selected ? ", selected" : ""}`;
              return (
                <button
                  key={sq}
                  type="button"
                  aria-label={label}
                  aria-pressed={sq === selected}
                  disabled={!canMove || pending || over}
                  onClick={() => tap(sq)}
                  className={`relative flex aspect-square items-center justify-center p-0 disabled:cursor-default ${dark ? "bg-[#8b74c9]" : "bg-[#e9e3f5]"}`}
                >
                  {isLast && <span className="absolute inset-0 bg-amber-300/55" />}
                  {sq === checkSquare && <span className="absolute inset-0 bg-[radial-gradient(circle,rgba(239,68,68,0.95)_0%,rgba(239,68,68,0.15)_75%)]" />}
                  {sq === selected && <span className="absolute inset-0 ring-4 ring-inset ring-amber-400" />}
                  {isTarget && (piece
                    ? <span className="absolute inset-0 rounded-full ring-[5px] ring-inset ring-[#1e1b2e]/45" />
                    : <span className="absolute h-[28%] w-[28%] rounded-full bg-[#1e1b2e]/40" />)}
                  {piece && <span className="relative"><Piece type={piece.type} color={piece.color} /></span>}
                  {file === files[0] && <span aria-hidden className={`absolute left-0.5 top-0 text-[10px] font-semibold ${dark ? "text-white/80" : "text-[#6b55a8]"}`}>{rank}</span>}
                  {rank === ranks[7] && <span aria-hidden className={`absolute bottom-0 right-1 text-[10px] font-semibold ${dark ? "text-white/80" : "text-[#6b55a8]"}`}>{file}</span>}
                </button>
              );
            }),
          )}
        </div>
        {promo && (
          <div role="dialog" aria-label="Choose a promotion piece" className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/60">
            <div className="flex gap-2 rounded-2xl bg-white p-3 dark:bg-neutral-900">
              {(["q", "r", "b", "n"] as const).map((p) => (
                <button key={p} type="button" aria-label={`Promote to ${NAME[p]}`} onClick={() => submit(promo.from, promo.to, p)}
                  className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#8b74c9] active:scale-95">
                  <Piece type={p} color={myColor ?? "w"} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {lostRow(bottom)}
      {error && <p role="alert" className="mt-1 text-sm text-red-500">{error}</p>}

      <h2 className="mt-4 font-semibold">Moves</h2>
      {history.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-500">No moves yet.</p>
      ) : (
        <ol aria-label="Move list" className="mt-1 grid grid-cols-[2rem_1fr_1fr] gap-x-2 text-sm tabular-nums">
          {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
            <li key={i} className="contents">
              <span className="text-neutral-500">{i + 1}.</span>
              <span className={history[i * 2] === last ? "font-bold" : ""}>{history[i * 2].san}</span>
              <span className={history[i * 2 + 1] === last ? "font-bold" : ""}>{history[i * 2 + 1]?.san}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
