import { Suspense } from "react";
import { LocationIndicator } from "@/components/location-indicator";
import { ErrorReporter } from "@/components/error-reporter";
import { NotificationBell } from "@/components/notification-bell";
import { PageSkeleton } from "@/components/page-skeleton";
import { Presence } from "@/components/presence";
import { BottomNav } from "@/components/bottom-nav";
import { getMe } from "@/lib/session";

async function MembershipGate({ children }: { children: React.ReactNode }) {
  await getMe(); // redirects to /login when signed out or not in a household
  return (
    <>
      <Presence />
      <ErrorReporter />
      <LocationIndicator />
      {children}
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md pb-32 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-3">
      <header className="mb-2 flex justify-end">
        <NotificationBell />
      </header>
      <Suspense fallback={<PageSkeleton />}>
        <MembershipGate>{children}</MembershipGate>
      </Suspense>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
