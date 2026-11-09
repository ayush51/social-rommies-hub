import { Suspense } from "react";
import { Presence } from "@/components/presence";
import { BottomNav } from "@/components/bottom-nav";
import { getMe } from "@/lib/session";

async function MembershipGate({ children }: { children: React.ReactNode }) {
  await getMe(); // redirects to /login when signed out or not in a household
  return (
    <>
      <Presence />
      {children}
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-24 pt-6">
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <MembershipGate>{children}</MembershipGate>
      </Suspense>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
