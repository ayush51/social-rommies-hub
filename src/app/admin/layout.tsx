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
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between bg-violet-700 px-4 py-3 text-white">
        <span className="font-bold">Admin mode</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/admin/features">Features</Link>
          <Link href="/admin/questions">Questions</Link>
          <Link href="/" className="font-semibold underline">Exit</Link>
        </nav>
      </header>
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </div>
  );
}
