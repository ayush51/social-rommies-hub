import Link from "next/link";
import { ProfileForm } from "@/components/profile-form";
import { signedUrls } from "@/lib/photos";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const me = await getMe();
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("nickname, dob, avatar_url").eq("id", me.userId).single();
  const urls = await signedUrls([p?.avatar_url ?? null], "avatars");

  return (
    <>
      <Link href="/" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Home</Link>
      <h1 className="mb-4 mt-2 text-3xl font-bold tracking-tight">{me.displayName}</h1>
      <ProfileForm
        householdId={me.householdId}
        userId={me.userId}
        name={me.displayName}
        nickname={p?.nickname ?? null}
        dob={p?.dob ?? null}
        avatarPath={p?.avatar_url ?? null}
        avatarUrl={p?.avatar_url ? urls.get(p.avatar_url) : undefined}
      />
    </>
  );
}
