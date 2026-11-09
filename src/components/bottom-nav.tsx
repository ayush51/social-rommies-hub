"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, CalendarDays, Gamepad2, House, MessageCircle } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/daily", label: "Daily", icon: Camera },
  { href: "/plans", label: "Plans", icon: CalendarDays },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/chat", label: "Chat", icon: MessageCircle },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <ul className="mx-auto flex max-w-md justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs ${
                  active ? "text-violet-600 dark:text-violet-400" : "text-neutral-500"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
