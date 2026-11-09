import { PetAdminForm } from "@/components/pet-admin";
import { requireAdmin } from "@/lib/admin";
import { loadPets } from "@/lib/pet-photos";

export default async function AdminPets() {
  const me = await requireAdmin();
  const { pets, photos } = await loadPets({ all: true });
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Pets</h1>
      <div className="mt-4 space-y-4">
        <PetAdminForm householdId={me.householdId} />
        {pets.map((p) => (
          <div key={p.id} className={p.active ? "" : "opacity-60"}>
            <PetAdminForm householdId={me.householdId} pet={p} photoUrl={(p.photo_path && photos.get(p.photo_path)) || undefined} />
          </div>
        ))}
      </div>
    </>
  );
}
