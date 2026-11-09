"use client";

// Rendered in the viewer's own timezone (server output is UTC, hence suppressHydrationWarning).
export function LocalTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
    </time>
  );
}
