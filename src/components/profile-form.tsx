"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { compress } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

type Props = {
  householdId: string;
  userId: string;
  name: string;
  nickname: string | null;
  dob: string | null;
  avatarPath: string | null;
  avatarUrl?: string;
};

export function ProfileForm({ householdId, userId, name, nickname, dob, avatarPath, avatarUrl }: Props) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [nick, setNick] = useState(nickname ?? "");
  const [birthday, setBirthday] = useState(dob ?? "");
  const [picked, setPicked] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(undefined);
    const supabase = createClient();
    try {
      let path = avatarPath;
      if (picked) {
        path = `${householdId}/${userId}/avatar-${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("avatars").upload(path, await compress(picked, 512), { contentType: "image/jpeg" });
        if (error) throw error;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ nickname: nick.trim() || null, dob: birthday || null, avatar_url: path })
        .eq("id", userId);
      if (error) throw error;
      if (picked && avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
      setPicked(undefined);
      setMsg("Saved.");
      router.refresh();
    } catch {
      setMsg("Couldn't save. Check the birthday and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar url={preview ?? avatarUrl} name={name} size={80} />
        <button type="button" onClick={() => file.current?.click()} className="rounded-2xl bg-neutral-100 px-4 py-2 text-sm font-semibold dark:bg-neutral-900">
          {avatarUrl || preview ? "Change photo" : "Add photo"}
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setPicked(f);
              setPreview(URL.createObjectURL(f));
            }
            e.target.value = "";
          }}
        />
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Nickname
        <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={40} placeholder="Optional" className="rounded-2xl bg-neutral-100 px-3 py-2 font-normal dark:bg-neutral-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Birthday
        <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} min="1900-01-01" max={new Date().toISOString().slice(0, 10)} className="rounded-2xl bg-neutral-100 px-3 py-2 font-normal dark:bg-neutral-900" />
      </label>
      <p className="text-xs text-neutral-500">Your roommates can see your photo, birthday and when you were last active.</p>
      <button disabled={busy} className="rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
      {msg && <p className="text-sm text-neutral-500">{msg}</p>}
    </form>
  );
}
