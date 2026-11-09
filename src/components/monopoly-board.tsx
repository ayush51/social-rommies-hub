import { cellFor, GROUP_COLORS, ICON, SEAT_COLORS, type BoardPlayer, type BoardProp, type Space } from "@/lib/monopoly";

type Props = {
  spaces: Space[];
  players: BoardPlayer[];
  props: BoardProp[];
  dice: number[] | null;
  turnName: string | null;
  statusText: string;
};

const short = (s: string) => (s.length > 9 ? s.slice(0, 8) + "…" : s);

export function MonopolyBoard({ spaces, players, props, dice, turnName, statusText }: Props) {
  const seatOf = (uid: string) => players.find((p) => p.user_id === uid)?.seat ?? 1;
  return (
    <div role="img" aria-label="Abingdon Street board" className="grid aspect-square w-full grid-cols-11 grid-rows-11 gap-px overflow-hidden rounded-2xl bg-neutral-300 dark:bg-neutral-700">
      {spaces.map((s) => {
        const { row, col } = cellFor(s.idx);
        const prop = props.find((p) => p.space === s.idx);
        const here = players.filter((p) => p.position === s.idx && !p.bankrupt);
        const label = `${s.name}${prop ? `, owned by ${players.find((p) => p.user_id === prop.owner_id)?.name}, level ${prop.level}` : ""}${here.length ? `, here: ${here.map((p) => p.name).join(", ")}` : ""}`;
        return (
          <div
            key={s.idx}
            aria-label={label}
            style={{ gridRow: row, gridColumn: col, boxShadow: prop ? `inset 0 0 0 2px ${SEAT_COLORS[(seatOf(prop.owner_id) - 1) % 6]}` : undefined }}
            className="relative flex min-w-0 flex-col justify-between overflow-hidden bg-white p-px text-[6px] leading-[1.1] sm:text-[8px] dark:bg-neutral-900"
          >
            {s.color ? <span className="block h-1.5 w-full" style={{ background: GROUP_COLORS[s.color] }} /> : <span className="block h-1.5" />}
            <span className="block truncate text-center font-medium">{ICON[s.kind] && s.kind !== "station" && s.kind !== "utility" ? ICON[s.kind] : short(s.name)}</span>
            <span className="flex min-h-2 flex-wrap items-center justify-center gap-px">
              {prop && prop.level > 0 && <span className="text-[6px] font-bold text-violet-600">{"+".repeat(prop.level)}</span>}
              {here.map((p) => (
                <span key={p.user_id} title={p.name} className="block h-2 w-2 rounded-full ring-1 ring-white" style={{ background: SEAT_COLORS[(p.seat - 1) % 6] }} />
              ))}
            </span>
          </div>
        );
      })}
      <div style={{ gridRow: "2 / 11", gridColumn: "2 / 11" }} className="flex flex-col items-center justify-center gap-2 bg-violet-50 p-2 text-center dark:bg-violet-950">
        <p className="text-sm font-bold">Abingdon Street</p>
        {dice && <p className="text-2xl font-bold tabular-nums" aria-label={`Last roll ${dice[0]} and ${dice[1]}`}>{dice[0]} + {dice[1]}</p>}
        <p className="text-xs text-neutral-600 dark:text-neutral-300">{statusText}</p>
        {turnName && <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">{turnName}&apos;s turn</p>}
      </div>
    </div>
  );
}
