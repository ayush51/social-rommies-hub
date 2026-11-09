"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { useUnread } from "@/lib/unread";

type Person = { id: string; name: string; avatarUrl?: string | null };

export function DmChips({ people }: { people: Person[] }) {
  const unread = useUnread();
  return (
    <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
      {people.map((p) => (
        <Link key={p.id} href={`/chat/dm/${p.id}`} className="relative flex min-h-11 shrink-0 flex-col items-center gap-1 text-xs text-neutral-600 dark:text-neutral-300">
          <Avatar url={p.avatarUrl} name={p.name} size={44} />
          {p.name}
          {(unread.dms[p.id] ?? 0) > 0 && (
            <span aria-label={`${unread.dms[p.id]} unread from ${p.name}`} className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-center text-[11px] font-bold leading-5 text-white">{unread.dms[p.id]}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
