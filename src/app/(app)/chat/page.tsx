import { DmChips } from "@/components/dm-chips";
import { ChatRoom, type Msg } from "@/components/chat-room";
import { signedUrls } from "@/lib/photos";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const COLS = "id, user_id, recipient_id, body, image_path, reply_to, created_at, edited_at";

export default async function ChatPage() {
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: recent }, { data: members }] = await Promise.all([
    supabase.from("messages").select(COLS).is("recipient_id", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("household_members").select("user_id, profiles(display_name, avatar_url)"),
  ]);
  const messages = (recent ?? []).reverse() as Msg[];
  const [{ data: reactions }, urls, avatars] = await Promise.all([
    supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", messages.map((m) => m.id)),
    signedUrls(messages.map((m) => m.image_path), "chat"),
    signedUrls((members ?? []).map((m) => m.profiles?.avatar_url ?? null), "avatars"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  const others = (members ?? []).filter((m) => m.user_id !== me.userId);

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Chat</h1>
      <DmChips people={others.map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? "", avatarUrl: m.profiles?.avatar_url ? avatars.get(m.profiles.avatar_url) : null }))} />
      <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Group</p>
      <ChatRoom
        className="h-[max(18rem,calc(100dvh-19.5rem))]"
        householdId={me.householdId}
        userId={me.userId}
        isAdmin={me.isAdmin}
        names={names}
        initialMessages={messages}
        initialReactions={reactions ?? []}
        initialUrls={Object.fromEntries(urls)}
      />
    </>
  );
}
