"use client";

// "Active now" / "5m ago" / "2h ago" / date. Client-side so it uses the viewer's clock.
export function SeenAt({ iso }: { iso: string | null }) {
  let text = "Not seen yet";
  if (iso) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    text =
      mins < 2 ? "Active now"
      : mins < 60 ? `${mins}m ago`
      : mins < 1440 ? `${Math.floor(mins / 60)}h ago`
      : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return <span suppressHydrationWarning>{text}</span>;
}
