import { QuestionReview } from "@/components/question-review";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminQuestions() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: items }, { data: members }] = await Promise.all([
    supabase.from("card_suggestions").select("id, user_id, text, status, used_on, created_at").order("created_at", { ascending: false }).limit(60),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const pending = (items ?? []).filter((i) => i.status === "pending");
  const queued = (items ?? []).filter((i) => i.status === "approved" && !i.used_on);
  const done = (items ?? []).filter((i) => (i.status === "approved" && i.used_on) || i.status === "rejected");

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Suggested questions</h1>
      <h2 className="mt-6 font-semibold">To review</h2>
      {pending.length === 0 && <p className="mt-2 text-sm text-neutral-500">Nothing waiting.</p>}
      <ul className="mt-2 space-y-2">
        {pending.map((i) => (
          <li key={i.id} className="rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900">
            <p className="font-medium">{i.text}</p>
            <p className="text-xs text-neutral-500">from {names[i.user_id]}</p>
            <QuestionReview id={i.id} />
          </li>
        ))}
      </ul>
      {queued.length > 0 && (
        <>
          <h2 className="mt-6 font-semibold">Approved, coming up</h2>
          <ul className="mt-2 space-y-1 text-sm">{queued.map((i) => <li key={i.id}>{i.text} <span className="text-neutral-500">· {names[i.user_id]}</span></li>)}</ul>
        </>
      )}
      {done.length > 0 && (
        <>
          <h2 className="mt-6 font-semibold text-neutral-500">Done</h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-500">
            {done.map((i) => <li key={i.id}>{i.text} · {i.status === "rejected" ? "rejected" : `used ${i.used_on}`}</li>)}
          </ul>
        </>
      )}
    </>
  );
}
