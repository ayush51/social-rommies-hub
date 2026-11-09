import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

type Stats = {
  messages_7d: number; posts_7d: number; bets_7d: number; plans_7d: number; active_24h: number; errors_7d: number; bingdons_in_circulation: number;
  members: { name: string; role: string; last_seen_at: string | null; messages_7d: number; posts_7d: number }[];
};

export default async function AdminStats() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: errors }] = await Promise.all([
    supabase.rpc("admin_stats"),
    supabase.from("app_errors").select("id, path, message, ua, created_at").order("created_at", { ascending: false }).limit(40),
  ]);
  const s = data as unknown as Stats | null;
  const tile = (label: string, value: number) => (
    <div key={label} className="rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-900"><p className="text-2xl font-bold tabular-nums">{value}</p><p className="text-xs text-neutral-500">{label}</p></div>
  );
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Stats</h1>
      {s && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[tile("Active in 24h", s.active_24h), tile("Messages this week", s.messages_7d), tile("Photos this week", s.posts_7d), tile("Bets this week", s.bets_7d), tile("Plans this week", s.plans_7d), tile("Errors this week", s.errors_7d)]}
          </div>
          <p className="mt-3 text-sm text-neutral-500">{s.bingdons_in_circulation} bingdons in circulation.</p>
          <h2 className="mt-6 font-semibold">By person (7 days)</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {s.members.map((m) => (
              <li key={m.name} className="flex justify-between gap-2 rounded-2xl bg-neutral-100 px-4 py-2 dark:bg-neutral-900">
                <span>{m.name}{m.role === "admin" ? " (admin)" : ""}</span>
                <span className="text-neutral-500">{m.messages_7d} msgs · {m.posts_7d} photos · seen {m.last_seen_at ? new Date(m.last_seen_at).toLocaleDateString() : "never"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2 className="mt-8 font-semibold">Error log</h2>
      {(errors ?? []).length === 0 && <p className="mt-1 text-sm text-neutral-500">No errors recorded. Nice.</p>}
      <ul className="mt-2 space-y-1 text-xs">
        {(errors ?? []).map((e) => (
          <li key={e.id} className="rounded-2xl bg-neutral-100 px-3 py-2 dark:bg-neutral-900">
            <p className="break-words font-medium">{e.message}</p>
            <p className="text-neutral-500">{e.path} · {new Date(e.created_at).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
