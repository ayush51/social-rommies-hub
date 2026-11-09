"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { PetAvatar } from "@/components/pet-avatar";
import { compress } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

type Pet = { id: string; name: string; species: string; bio: string; photo_path: string | null; active: boolean };

const field = "min-h-11 w-full rounded-2xl bg-white px-4 py-2 dark:bg-neutral-800";

// Create (no `pet`) or edit one pet. Photos are compressed in the browser and uploaded to the private `pets` bucket.
export function PetAdminForm({ householdId, pet, photoUrl }: { householdId: string; pet?: Pet; photoUrl?: string }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(pet?.name ?? "");
  const [species, setSpecies] = useState(pet?.species ?? "");
  const [bio, setBio] = useState(pet?.bio ?? "");
  const [picked, setPicked] = useState<File>();
  const [preview, setPreview] = useState(photoUrl);
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPicked(f);
    setPreview(URL.createObjectURL(f));
    e.target.value = "";
  };

  const save = (active: boolean) =>
    start(async () => {
      const supabase = createClient();
      try {
        let id = pet?.id;
        if (!id) {
          const { data, error } = await supabase.rpc("pets_create", { p_name: name, p_species: species, p_bio: bio });
          if (error) throw error;
          id = data as string;
        }
        let path: string | undefined;
        if (picked) {
          path = `${householdId}/${id}/${crypto.randomUUID()}.jpg`;
          const { error } = await supabase.storage.from("pets").upload(path, await compress(picked, 1200), { contentType: "image/jpeg" });
          if (error) throw error;
        }
        if (pet || path || !active) {
          const { error } = await supabase.rpc("pets_update", { p_pet: id, p_name: name, p_species: species, p_bio: bio, p_photo_path: (path ?? null) as string,p_active: active });
          if (error) throw error;
        }
        if (path && pet?.photo_path) await supabase.storage.from("pets").remove([pet.photo_path]);
        setMsg(pet ? "Saved." : "Added.");
        if (!pet) {
          setName("");
          setSpecies("");
          setBio("");
          setPicked(undefined);
          setPreview(undefined);
        }
        setPicked(undefined);
        router.refresh();
      } catch (e) {
        setMsg((e as Error).message.replace(/^.*?: /, ""));
      }
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(pet?.active ?? true);
      }}
      className="space-y-2 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900"
      aria-label={pet ? `Edit ${pet.name}` : "Add a pet"}
    >
      <div className="flex items-center gap-3">
        <PetAvatar url={preview} name={name || "New pet"} className="h-16 w-16 shrink-0 rounded-2xl" />
        <button type="button" onClick={() => file.current?.click()} className="flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-medium dark:bg-neutral-800">
          <Camera size={16} aria-hidden /> {preview ? "Change photo" : "Add photo"}
        </button>
        <input ref={file} type="file" accept="image/*" onChange={pick} hidden aria-label="Pet photo" />
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="Name" aria-label="Name" className={field} />
      <input value={species} onChange={(e) => setSpecies(e.target.value)} maxLength={40} required placeholder="Species (cat, dog...)" aria-label="Species" className={field} />
      <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={2} placeholder="Bio" aria-label="Bio" className={`${field} py-3`} />
      <div className="flex gap-2">
        <button disabled={pending || !name.trim() || !species.trim()} className="min-h-11 flex-1 rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {pet ? "Save" : "Add pet"}
        </button>
        {pet && (
          <button type="button" disabled={pending} onClick={() => save(!pet.active)} className="min-h-11 rounded-2xl bg-white px-4 text-sm font-semibold dark:bg-neutral-800">
            {pet.active ? "Deactivate" : "Activate"}
          </button>
        )}
      </div>
      {msg && <p role="status" className="text-sm text-neutral-500">{msg}</p>}
    </form>
  );
}
