import type { CardPast } from "@/lib/cards";

export function PastQuestions({ days }: { days: CardPast }) {
  return (
    <details className="mt-3 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <summary className="cursor-pointer py-3 text-sm font-semibold">Past questions</summary>
      {days.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Yesterday&apos;s question will show up here.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {days.map((d) => (
            <li key={d.date}>
              <p className="text-xs text-neutral-500">
                {new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                {d.suggested_by && ` · suggested by ${d.suggested_by}`}
              </p>
              <p className="text-sm font-medium">{d.prompt}</p>
              <p className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">
                {d.winners.length ? `Most likely: ${d.winners.join(", ")}` : d.voted_count ? "Tied with no leader" : "Nobody voted"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
