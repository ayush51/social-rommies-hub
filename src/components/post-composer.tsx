"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoSlot } from "@/components/photo-slot";
import { compress } from "@/lib/image";
import { notify } from "@/app/(app)/push-actions";
import { createClient } from "@/lib/supabase/client";

type Existing = { id: string; photo_path: string; selfie_path: string | null; caption: string | null };
type Props = {
  householdId: string;
  userId: string;
  existing?: Existing;
  existingUrls?: { photo?: string; selfie?: string };
};

const usePreview = (file?: File, fallback?: string) => {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url ?? fallback;
};

export function PostComposer({ householdId, userId, existing, existingUrls }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [main, setMain] = useState<File>();
  const [selfie, setSelfie] = useState<File>();
  const [caption, setCaption] = useState(existing?.caption ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const mainPreview = usePreview(main, existingUrls?.photo);
  const selfiePreview = usePreview(selfie, existingUrls?.selfie);

  async function submit() {
    if (!main && !existing) return setError("Add a main photo first.");
    setBusy(true);
    setError(undefined);
    const supabase = createClient();
    const stamp = Date.now();
    try {
      const upload = async (file: File, tag: string) => {
        const path = `${householdId}/${userId}/${stamp}-${tag}.jpg`;
        const { error } = await supabase.storage.from("daily").upload(path, await compress(file), { contentType: "image/jpeg" });
        if (error) throw error;
        return path;
      };
      const photo_path = main ? await upload(main, "main") : existing!.photo_path;
      const selfie_path = selfie ? await upload(selfie, "selfie") : (existing?.selfie_path ?? null);
      const fields = { photo_path, selfie_path, caption: caption.trim() || null };
      let error;
      if (existing) {
        ({ error } = await supabase.from("daily_posts").update(fields).eq("id", existing.id));
      } else {
        const res = await supabase
          .from("daily_posts")
          .insert({ household_id: householdId, user_id: userId, ...fields })
          .select("id")
          .single();
        error = res.error;
        if (res.data) void notify("post", res.data.id);
      }
      if (error) throw error;
      const stale = [main && existing?.photo_path, selfie && existing?.selfie_path].filter(Boolean) as string[];
      if (stale.length) await supabase.storage.from("daily").remove(stale);
      setOpen(false);
      setMain(undefined);
      setSelfie(undefined);
      router.refresh();
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-3xl bg-violet-600 py-4 text-lg font-semibold text-white active:scale-[0.98]">
        {existing ? "Replace today's photo" : "Post today's photo"}
      </button>
    );
  }

  return (
    <section className="rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <div className="grid grid-cols-2 gap-3">
        <PhotoSlot label="Main photo" facing="environment" preview={mainPreview} onPick={setMain} />
        <PhotoSlot label="Selfie (optional)" facing="user" preview={selfiePreview} onPick={setSelfie} />
      </div>
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={200}
        placeholder="Caption or quote"
        className="mt-3 w-full rounded-2xl bg-white px-3 py-2 dark:bg-neutral-800"
      />
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={submit} disabled={busy} className="flex-1 rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-60">
          {busy ? "Posting…" : "Post"}
        </button>
        <button onClick={() => setOpen(false)} disabled={busy} className="rounded-2xl px-4 text-neutral-500">Cancel</button>
      </div>
    </section>
  );
}
