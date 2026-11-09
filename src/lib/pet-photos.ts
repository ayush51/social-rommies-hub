import { createClient } from "@/lib/supabase/server";

export type Pet = {
  id: string;
  name: string;
  species: string;
  bio: string;
  photo_path: string | null;
  active: boolean;
  hunger: number;
  happiness: number;
  last_fed_by: string | null;
  last_fed_at: string | null;
  feeds_left: number;
  treats_left: number;
};

// Short-lived signed URLs for pet photos (private `pets` bucket).
export async function petPhotoUrls(paths: (string | null)[]) {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (!wanted.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("pets").createSignedUrls(wanted, 3600);
  data?.forEach((d) => d.path && d.signedUrl && map.set(d.path, d.signedUrl));
  return map;
}

export async function loadPets(opts: { id?: string; all?: boolean } = {}) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("pets_overview", { p_pet: opts.id, p_all: opts.all ?? false });
  const pets = (data ?? []) as Pet[];
  return { pets, photos: await petPhotoUrls(pets.map((p) => p.photo_path)) };
}
