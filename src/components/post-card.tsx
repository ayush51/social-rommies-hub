"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type PostView = {
  id: string;
  user_id: string;
  caption: string | null;
  photoUrl?: string;
  selfieUrl?: string;
  reactions: { user_id: string; emoji: string }[];
  comments: { id: string; user_id: string; body: string }[];
};

const EMOJI = ["❤️", "😂", "🔥", "😮", "👏"];

type Props = { post: PostView; householdId: string; userId: string; isAdmin: boolean; names: Record<string, string> };

export function PostCard({ post, householdId, userId, isAdmin, names }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [draft, setDraft] = useState("");
  const [tipMsg, setTipMsg] = useState<string>();

  async function react(emoji: string) {
    const mine = post.reactions.some((r) => r.user_id === userId && r.emoji === emoji);
    if (mine) await supabase.from("post_reactions").delete().match({ post_id: post.id, user_id: userId, emoji });
    else await supabase.from("post_reactions").insert({ post_id: post.id, user_id: userId, household_id: householdId, emoji });
    router.refresh();
  }

  async function tip(amount: number) {
    const { error } = await supabase.rpc("tip_post", { p_post: post.id, p_amount: amount, p_key: crypto.randomUUID() });
    setTipMsg(
      !error ? `Tipped ${amount} bingdons`
      : error.message.includes("insufficient") ? "Not enough bingdons."
      : error.message.includes("slow down") ? "Slow down a little."
      : "Tip failed.",
    );
  }

  async function comment(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await supabase.from("post_comments").insert({ post_id: post.id, user_id: userId, household_id: householdId, body });
    router.refresh();
  }

  async function removeComment(id: string) {
    await supabase.from("post_comments").delete().eq("id", id);
    router.refresh();
  }

  return (
    <article className="overflow-hidden rounded-3xl bg-neutral-100 dark:bg-neutral-900">
      <p className="px-4 pt-3 font-semibold">{names[post.user_id]}</p>
      <div className="relative mt-2 aspect-[3/4] bg-neutral-200 dark:bg-neutral-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {post.photoUrl && <img src={post.photoUrl} alt="" className="h-full w-full object-cover" />}
        {post.selfieUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.selfieUrl} alt="" className="absolute left-3 top-3 w-1/3 rounded-2xl border-2 border-white object-cover shadow" />
        )}
      </div>
      <div className="p-4">
        {post.caption && <p className="mb-2">{post.caption}</p>}
        <div className="flex flex-wrap gap-1.5">
          {EMOJI.map((emoji) => {
            const n = post.reactions.filter((r) => r.emoji === emoji).length;
            const mine = post.reactions.some((r) => r.emoji === emoji && r.user_id === userId);
            return (
              <button key={emoji} onClick={() => react(emoji)} className={`rounded-full px-3 py-1 text-sm active:scale-110 ${mine ? "bg-violet-200 dark:bg-violet-900" : "bg-white dark:bg-neutral-800"}`}>
                {emoji}{n > 0 && ` ${n}`}
              </button>
            );
          })}
        </div>
        {post.user_id !== userId && (
          <div className="mt-3 flex items-center gap-1.5 text-sm">
            <Coins size={16} className="text-neutral-500" />
            {[5, 10, 25].map((n) => (
              <button key={n} onClick={() => tip(n)} className="rounded-full bg-white px-3 py-1 active:scale-110 dark:bg-neutral-800">{n}</button>
            ))}
            {tipMsg && <span className="ml-1 text-neutral-500">{tipMsg}</span>}
          </div>
        )}
        <ul className="mt-3 space-y-1 text-sm">
          {post.comments.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2">
              <span><b>{names[c.user_id]}</b> {c.body}</span>
              {(c.user_id === userId || isAdmin) && (
                <button onClick={() => removeComment(c.id)} aria-label="Delete comment" className="text-neutral-400"><Trash2 size={14} /></button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={comment} className="mt-3 flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="Add a comment" className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-sm dark:bg-neutral-800" />
          <button aria-label="Send comment" className="rounded-full bg-violet-600 p-2 text-white"><Send size={16} /></button>
        </form>
      </div>
    </article>
  );
}
