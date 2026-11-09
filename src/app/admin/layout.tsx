import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";

// Server-side gate: non-admins get a 404 for every /admin URL, whatever the UI shows.
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 bg-violet-700 px-4 py-1 text-white">
        <span className="shrink-0 font-bold">Admin mode</span>
        <nav className="-mr-2 flex gap-1 overflow-x-auto text-sm [&_a]:flex [&_a]:min-h-11 [&_a]:shrink-0 [&_a]:items-center [&_a]:px-2">
          <Link href="/admin/features">Features</Link>
          <Link href="/admin/questions">Questions</Link>
          <Link href="/admin/pets">Pets</Link>
          <Link href="/admin/roommates">People</Link>
          <Link href="/admin/settings">Settings</Link>
          <Link href="/admin/moderation">Moderate</Link>
          <Link href="/admin/stats">Stats</Link>
          <Link href="/" className="font-semibold underline">Exit</Link>
        </nav>
      </header>
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </div>
  );
}
