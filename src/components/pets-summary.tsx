import Link from "next/link";
import { PawPrint } from "lucide-react";
import { loadPets } from "@/lib/pet-photos";

// Compact Home card showing the hungriest pet. Reads the session, so mount it inside <Suspense>.
export async function PetsSummary() {
  const { pets } = await loadPets();
  const top = [...pets].sort((a, b) => b.hunger - a.hunger)[0];
  return (
    <Link href="/pets" className="flex min-h-11 items-center justify-between gap-3 rounded-3xl bg-neutral-100 px-5 py-4 dark:bg-neutral-900">
      <span className="flex items-center gap-2 font-semibold"><PawPrint size={18} aria-hidden /> Pets</span>
      <span className="truncate text-sm text-neutral-500">{top ? `${top.name} · hunger ${top.hunger}` : "No pets yet"}</span>
    </Link>
  );
}
