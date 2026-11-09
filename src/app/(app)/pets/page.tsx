import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { PetAgo } from "@/components/pet-ago";
import { PetAvatar } from "@/components/pet-avatar";
import { PetBars } from "@/components/pet-bars";
import { PetButtons } from "@/components/pet-buttons";
import { loadPets } from "@/lib/pet-photos";
import { getMe } from "@/lib/session";

export default async function PetsPage() {
  const me = await getMe();
  const { pets, photos } = await loadPets();
  return (
    <>
      {(["pet_actions", "pets"] as const).map((t) => <LiveRefresh key={t} table={t} householdId={me.householdId} />)}
      <h1 className="text-3xl font-bold tracking-tight">Pets</h1>
      <div className="mt-4 space-y-4">
        {pets.length === 0 && (
          <p className="text-neutral-500">
            No pets yet.{" "}
            {me.isAdmin && <Link href="/admin/pets" className="inline-flex min-h-11 items-center text-violet-600 dark:text-violet-400">Add one</Link>}
          </p>
        )}
        {pets.map((p) => (
          <section key={p.id} aria-label={p.name} className="rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
            <div className="flex items-center gap-3">
              <PetAvatar url={p.photo_path && photos.get(p.photo_path)} name={p.name} className="h-20 w-20 shrink-0 rounded-2xl" />
              <div className="min-w-0">
                <Link href={`/pets/${p.id}`} className="inline-flex min-h-11 items-center text-xl font-bold leading-tight">{p.name}</Link>
                <p className="-mt-1 truncate text-sm text-neutral-500">{p.species}</p>
              </div>
            </div>
            <div className="mt-3"><PetBars hunger={p.hunger} happiness={p.happiness} /></div>
            <p className="mt-2 text-xs text-neutral-500">
              {p.last_fed_by && p.last_fed_at ? <>Last fed by {p.last_fed_by} · <PetAgo iso={p.last_fed_at} /></> : "Nobody has fed them yet."}
            </p>
            <div className="mt-3"><PetButtons petId={p.id} name={p.name} feedsLeft={p.feeds_left} treatsLeft={p.treats_left} /></div>
          </section>
        ))}
      </div>
    </>
  );
}
