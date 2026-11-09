import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatRoom, type Msg } from "@/components/chat-room";
import { signedUrls } from "@/lib/photos";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const COLS = "id, user_id, recipient_id, body, image_path, reply_to, created_at";

export default async function DmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await getMe();
  if (id === me.userId) notFound();
  const supabase = await createClient();
  const { data: members } = await supabase.from("household_members").select("user_id, profiles(display_name)");
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? ""]));
  if (!names[id]) notFound();

  const { data: recent } = await supabase
    .from("messages")
    .select(COLS)
    .or(`and(user_id.eq.${me.userId},recipient_id.eq.${id}),and(user_id.eq.${id},recipient_id.eq.${me.userId})`)
    .order("created_at", { ascending: false })
    .limit(50);
  const messages = (recent ?? []).reverse() as Msg[];
  const [{ data: reactions }, urls] = await Promise.all([
    supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", messages.map((m) => m.id)),
    signedUrls(messages.map((m) => m.image_path), "chat"),
  ]);

  return (
    <>
      <Link href="/chat" className="inline-flex min-h-11 min-w-11 items-center text-sm text-violet-600 dark:text-violet-400">Chat</Link>
      <h1 className="mb-2 mt-1 text-3xl font-bold tracking-tight">{names[id]}</h1>
      <ChatRoom
        className="h-[max(18rem,calc(100dvh-15rem))]"
        householdId={me.householdId}
        userId={me.userId}
        isAdmin={me.isAdmin}
        names={names}
        peerId={id}
        initialMessages={messages}
        initialReactions={reactions ?? []}
        initialUrls={Object.fromEntries(urls)}
      />
    </>
  );
}
