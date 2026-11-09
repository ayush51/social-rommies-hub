import { ChatRoom } from "@/components/chat-room";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function ChatPage() {
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: recent }, { data: members }] = await Promise.all([
    supabase.from("messages").select("id, user_id, body, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("household_members").select("user_id, profiles(display_name)"),
  ]);
  const messages = (recent ?? []).reverse();
  const { data: reactions } = await supabase
    .from("message_reactions")
    .select("message_id, user_id, emoji")
    .in("message_id", messages.map((m) => m.id));

  return (
    <ChatRoom
      householdId={me.householdId}
      userId={me.userId}
      isAdmin={me.isAdmin}
      names={Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]))}
      initialMessages={messages}
      initialReactions={reactions ?? []}
    />
  );
}
