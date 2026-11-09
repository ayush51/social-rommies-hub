import { Drumstick, Heart } from "lucide-react";

function Bar({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex w-20 shrink-0 items-center gap-1 font-medium text-neutral-600 dark:text-neutral-400">{icon}{label}</span>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
      >
        <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums text-neutral-500">{value}</span>
    </div>
  );
}

export function PetBars({ hunger, happiness }: { hunger: number; happiness: number }) {
  return (
    <div className="space-y-1.5">
      <Bar label="Hunger" value={hunger} icon={<Drumstick size={14} aria-hidden />} tone={hunger >= 80 ? "bg-red-500" : hunger >= 50 ? "bg-amber-500" : "bg-emerald-500"} />
      <Bar label="Happiness" value={happiness} icon={<Heart size={14} aria-hidden />} tone="bg-violet-500" />
    </div>
  );
}
