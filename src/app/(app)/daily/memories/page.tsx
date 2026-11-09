import Link from "next/link";
import { signedUrls } from "@/lib/photos";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function MemoriesPage() {
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: posts }, { data: members }] = await Promise.all([
    supabase.rpc("memories", { p_household: me.householdId }),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const urls = await signedUrls((posts ?? []).map((p) => p.photo_path));
  const days = Map.groupBy(posts ?? [], (p) => p.local_date);

  return (
    <>
      <Link href="/daily" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Back to today</Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Memories</h1>
      {days.size === 0 && <p className="mt-2 text-neutral-500">Nothing yet. Yesterday&apos;s photos land here.</p>}
      {[...days].map(([date, items]) => (
        <section key={date} className="mt-6">
          <h2 className="mb-2 font-semibold">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</h2>
          <div className="grid grid-cols-2 gap-2">
            {items.map((p) => (
              <figure key={p.id} className="overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls.get(p.photo_path)} alt="" className="aspect-[3/4] w-full object-cover" />
                <figcaption className="p-2 text-xs"><b>{names[p.user_id]}</b>{p.caption && ` · ${p.caption}`}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
