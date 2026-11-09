import Link from "next/link";
import { ChangeCodeForm } from "@/components/change-code-form";
import { NotificationSettings } from "@/components/notification-settings";
import { ProfileForm } from "@/components/profile-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { signedUrls } from "@/lib/photos";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const me = await getMe();
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("nickname, dob, avatar_url").eq("id", me.userId).single();
  const urls = await signedUrls([p?.avatar_url ?? null], "avatars");
  const { data: prefs } = await supabase.from("notification_prefs").select("muted, quiet_start, quiet_end").eq("user_id", me.userId).maybeSingle();

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
      <h2 className="mt-10 text-xl font-bold tracking-tight">Appearance</h2>
      <div className="mt-3"><ThemeToggle /></div>

      <h2 className="mt-10 text-xl font-bold tracking-tight">Notifications</h2>
      <p className="mb-3 mt-1 text-sm text-neutral-500">Turn on pings for this device with the bell at the top. Choose what you get here.</p>
      <NotificationSettings muted={prefs?.muted ?? []} quietStart={prefs?.quiet_start ?? null} quietEnd={prefs?.quiet_end ?? null} />

      <h2 className="mt-10 text-xl font-bold tracking-tight">Login code</h2>
      <p className="mb-3 mt-1 text-sm text-neutral-500">Keep it to yourself. Anyone with your code can act as you.</p>
      <ChangeCodeForm />
    </>
  );
}
