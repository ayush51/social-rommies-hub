import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { PostCard, type PostView } from "@/components/post-card";
import { PostComposer } from "@/components/post-composer";
import { signedUrls } from "@/lib/photos";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function DailyPage() {
  const me = await getMe();
  const supabase = await createClient();
  // RLS only returns posts from the household-local "today".
  const { data: posts } = await supabase
    .from("daily_posts")
    .select("id, user_id, photo_path, selfie_path, caption")
    .order("created_at", { ascending: false });
  const ids = (posts ?? []).map((p) => p.id);
  const [{ data: reactions }, { data: comments }, { data: members }, urls] = await Promise.all([
    supabase.from("post_reactions").select("post_id, user_id, emoji").in("post_id", ids),
    supabase.from("post_comments").select("id, post_id, user_id, body").in("post_id", ids).order("created_at"),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
    signedUrls((posts ?? []).flatMap((p) => [p.photo_path, p.selfie_path])),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const mine = posts?.find((p) => p.user_id === me.userId);
  const waiting = (members ?? []).filter((m) => !posts?.some((p) => p.user_id === m.user_id)).map((m) => names[m.user_id]);

  const views: PostView[] = (posts ?? []).map((p) => ({
    id: p.id,
    user_id: p.user_id,
    caption: p.caption,
    photoUrl: urls.get(p.photo_path),
    selfieUrl: p.selfie_path ? urls.get(p.selfie_path) : undefined,
    reactions: (reactions ?? []).filter((r) => r.post_id === p.id),
    comments: (comments ?? []).filter((c) => c.post_id === p.id),
  }));

  return (
    <>
      {(["daily_posts", "post_reactions", "post_comments"] as const).map((t) => (
        <LiveRefresh key={t} table={t} householdId={me.householdId} />
      ))}
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Daily</h1>
        <Link href="/daily/memories" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Memories</Link>
      </div>
      <div className="mt-4">
        <PostComposer
          key={mine?.id ?? "new"}
          householdId={me.householdId}
          userId={me.userId}
          existing={mine}
          existingUrls={mine ? { photo: urls.get(mine.photo_path), selfie: mine.selfie_path ? urls.get(mine.selfie_path) : undefined } : undefined}
        />
      </div>
      {waiting.length > 0 && <p className="mt-3 text-sm text-neutral-500">Waiting on {waiting.join(", ")}</p>}
      <div className="mt-4 space-y-4">
        {views.map((v) => (
          <PostCard key={v.id} post={v} householdId={me.householdId} userId={me.userId} isAdmin={me.isAdmin} names={names} />
        ))}
      </div>
    </>
  );
}
