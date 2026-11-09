import { createClient } from "@/lib/supabase/server";

// Short-lived signed URLs for private storage paths.
export async function signedUrls(paths: (string | null)[], bucket: "daily" | "avatars" = "daily") {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (!wanted.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(wanted, 3600);
  data?.forEach((d) => d.path && d.signedUrl && map.set(d.path, d.signedUrl));
  return map;
}
