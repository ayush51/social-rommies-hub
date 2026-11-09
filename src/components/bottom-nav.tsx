"use client";

import Link, { useLinkStatus } from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useUnread } from "@/lib/unread";
import { Camera, CalendarDays, Gamepad2, House, MessageCircle } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/daily", label: "Daily", icon: Camera },
  { href: "/plans", label: "Plans", icon: CalendarDays },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/chat", label: "Chat", icon: MessageCircle },
];

// Thin bar across the top while the next page loads (the old page stays until the new one is ready).
function PendingBar() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-violet-600" /> : null;
}

export function BottomNav() {
  const pathname = usePathname();
  const unread = useUnread();
  // instant feedback: the tapped tab lights up at once; the entry is ignored as soon as the path changes
  const [tapped, setTapped] = useState<{ href: string; from: string }>();
  const current = tapped && tapped.from === pathname ? tapped.href : pathname;
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white pb-[max(env(safe-area-inset-bottom),0.75rem)] dark:border-neutral-800 dark:bg-neutral-950">
      <ul className="mx-auto flex max-w-md">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? current === "/" : current.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onPointerDown={() => setTapped({ href, from: pathname })}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 pt-1 text-xs font-medium active:bg-neutral-100 dark:active:bg-neutral-900 ${
                  active ? "text-violet-600 dark:text-violet-400" : "text-neutral-500"
                }`}
              >
                <PendingBar />
                <span className="relative">
                  <Icon size={24} strokeWidth={active ? 2.5 : 2} />
                  {href === "/chat" && unread.total > 0 && (
                    <span aria-label={`${unread.total} unread`} className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread.total > 9 ? "9+" : unread.total}</span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
