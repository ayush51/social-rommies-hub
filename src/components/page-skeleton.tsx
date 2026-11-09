export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-4 pt-2">
      <div className="h-9 w-44 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-40 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" />
      <div className="h-24 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" />
      <div className="h-24 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" />
    </div>
  );
}
