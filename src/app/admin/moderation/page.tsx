import Link from "next/link";
import { DeleteRow } from "@/components/delete-row";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminModeration() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: messages }, { data: posts }, { data: pc }, { data: plc }, { data: fc }, { data: waiting }, { data: members }] = await Promise.all([
    supabase.from("messages").select("id, user_id, body, image_path, created_at").is("recipient_id", null).order("created_at", { ascending: false }).limit(25),
    supabase.from("daily_posts").select("id, user_id, caption, photo_path, selfie_path"),
    supabase.from("post_comments").select("id, user_id, body").order("created_at", { ascending: false }).limit(15),
    supabase.from("plan_comments").select("id, user_id, body").order("created_at", { ascending: false }).limit(15),
    supabase.from("feature_comments").select("id, user_id, body").order("created_at", { ascending: false }).limit(15),
    supabase.from("markets").select("id, question, resolver_id").eq("status", "open").lt("closes_at", new Date().toISOString()),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? "?"]));
  const row = (key: string, who: string, text: string, del: React.ReactNode) => (
    <li key={key} className="flex items-start justify-between gap-2 rounded-2xl bg-neutral-100 px-4 py-2 text-sm dark:bg-neutral-900">
      <span className="min-w-0 py-2"><b>{who}</b> <span className="break-words">{text}</span></span>
      {del}
    </li>
  );
  const section = (title: string, items: React.ReactNode[]) => (
    <section className="mt-6">
      <h2 className="font-semibold">{title}</h2>
      {items.length ? <ul className="mt-2 space-y-1">{items}</ul> : <p className="mt-1 text-sm text-neutral-500">Nothing here.</p>}
    </section>
  );

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Moderate</h1>
      <p className="mt-1 text-sm text-neutral-500">Remove group chat messages, today&apos;s photos and comments. DMs are private and never shown here.</p>
      {section("Group chat", (messages ?? []).map((m) => row(m.id, names[m.user_id], m.body || "(photo)", <DeleteRow table="messages" id={m.id} files={m.image_path ? [m.image_path] : []} bucket="chat" />)))}
      {section("Today's photos", (posts ?? []).map((p) => row(p.id, names[p.user_id], p.caption || "(no caption)", <DeleteRow table="daily_posts" id={p.id} files={[p.photo_path, ...(p.selfie_path ? [p.selfie_path] : [])]} bucket="daily" />)))}
      {section("Photo comments", (pc ?? []).map((c) => row(c.id, names[c.user_id], c.body, <DeleteRow table="post_comments" id={c.id} />)))}
      {section("Plan comments", (plc ?? []).map((c) => row(c.id, names[c.user_id], c.body, <DeleteRow table="plan_comments" id={c.id} />)))}
      {section("Feature comments", (fc ?? []).map((c) => row(c.id, names[c.user_id], c.body, <DeleteRow table="feature_comments" id={c.id} />)))}
      {section("Predictions waiting for a resolver", (waiting ?? []).map((m) => row(m.id, names[m.resolver_id], m.question, <Link href={`/predictions/${m.id}`} className="flex min-h-11 items-center px-2 text-sm text-violet-600 underline dark:text-violet-400">Open</Link>)))}
    </>
  );
}
