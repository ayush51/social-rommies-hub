import Link from "next/link";
import { PlanForm } from "@/components/plan-form";
import { getMe } from "@/lib/session";

export default async function NewPlanPage() {
  const me = await getMe();
  return (
    <>
      <Link href="/plans" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Back</Link>
      <h1 className="mb-4 mt-2 text-3xl font-bold tracking-tight">New plan</h1>
      <PlanForm householdId={me.householdId} userId={me.userId} />
    </>
  );
}
