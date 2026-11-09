import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { PetAgo } from "@/components/pet-ago";
import { PetAvatar } from "@/components/pet-avatar";
import { PetBars } from "@/components/pet-bars";
import { PetButtons } from "@/components/pet-buttons";
import { loadPets } from "@/lib/pet-photos";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function PetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  const supabase = await createClient();
  const [{ pets, photos }, { data: recent }] = await Promise.all([loadPets({ id }), supabase.rpc("pets_recent", { p_pet: id, p_limit: 20 })]);
  const p = pets[0];
  if (!p) notFound();

  return (
    <>
      {(["pet_actions", "pets"] as const).map((t) => <LiveRefresh key={t} table={t} householdId={me.householdId} />)}
      <Link href="/pets" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Pets</Link>
      <PetAvatar url={p.photo_path && photos.get(p.photo_path)} name={p.name} className="mt-1 aspect-square w-full rounded-3xl" />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{p.name}</h1>
      <p className="text-sm text-neutral-500">{p.species}</p>
      {p.bio && <p className="mt-3">{p.bio}</p>}
      <div className="mt-4"><PetBars hunger={p.hunger} happiness={p.happiness} /></div>
      <div className="mt-4"><PetButtons petId={p.id} name={p.name} feedsLeft={p.feeds_left} treatsLeft={p.treats_left} /></div>
      <h2 className="mt-8 font-semibold">Recent activity</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {(recent ?? []).length === 0 && <li className="text-neutral-500">Nothing yet.</li>}
        {(recent ?? []).map((a, i) => (
          <li key={i} className="flex justify-between gap-3 border-b border-neutral-200 py-2 dark:border-neutral-800">
            <span>{a.display_name} {a.kind === "feed" ? "fed" : "gave a treat to"} {p.name}</span>
            <span className="shrink-0 text-xs text-neutral-500"><PetAgo iso={a.created_at} /></span>
          </li>
        ))}
      </ul>
    </>
  );
}
