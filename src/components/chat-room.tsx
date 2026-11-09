"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type Msg = { id: string; user_id: string; body: string; created_at: string };
export type Reaction = { message_id: string; user_id: string; emoji: string };

const EMOJI = ["👍", "😂", "❤️", "🔥", "😮"];

type Props = {
  householdId: string;
  userId: string;
  isAdmin: boolean;
  names: Record<string, string>;
  initialMessages: Msg[];
  initialReactions: Reaction[];
};

export function ChatRoom({ householdId, userId, isAdmin, names, initialMessages, initialReactions }: Props) {
  const supabase = useRef(createClient()).current;
  const [messages, setMessages] = useState(initialMessages);
  const [reactions, setReactions] = useState(initialReactions);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<string>();
  const [error, setError] = useState<string>();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const filter = `household_id=eq.${householdId}`;
    const channel = supabase
      .channel(`chat:${householdId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter }, (p) => {
        const m = p.new as Msg;
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter }, (p) => {
        const id = (p.old as Msg).id;
        setMessages((cur) => cur.filter((x) => x.id !== id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions", filter }, (p) => {
        const r = p.new as Reaction;
        setReactions((cur) => (cur.some((x) => same(x, r)) ? cur : [...cur, r]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions", filter }, (p) => {
        const r = p.old as Reaction;
        setReactions((cur) => cur.filter((x) => !same(x, r)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, householdId]);

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ household_id: householdId, user_id: userId, body })
      .select("id, user_id, body, created_at")
      .single();
    if (error) {
      setError(error.message === "slow down" ? "Slow down a little." : "Message failed to send.");
      setDraft(body);
    } else {
      setError(undefined);
      setMessages((cur) => (cur.some((x) => x.id === data.id) ? cur : [...cur, data]));
    }
  }

  async function react(messageId: string, emoji: string) {
    const mine = reactions.find((r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji);
    if (mine) {
      setReactions((cur) => cur.filter((x) => !same(x, mine)));
      await supabase.from("message_reactions").delete().match({ message_id: messageId, user_id: userId, emoji });
    } else {
      const r = { message_id: messageId, user_id: userId, emoji };
      setReactions((cur) => [...cur, r]);
      await supabase.from("message_reactions").insert({ ...r, household_id: householdId });
    }
  }

  async function remove(id: string) {
    setMessages((cur) => cur.filter((x) => x.id !== id));
    await supabase.from("messages").delete().eq("id", id);
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col">
      <h1 className="mb-3 text-3xl font-bold tracking-tight">Chat</h1>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && <p className="text-neutral-500">Quiet in here. Say something.</p>}
        {messages.map((m) => {
          const mine = m.user_id === userId;
          const counts = new Map<string, { n: number; mine: boolean }>();
          reactions.filter((r) => r.message_id === m.id).forEach((r) => {
            const c = counts.get(r.emoji) ?? { n: 0, mine: false };
            counts.set(r.emoji, { n: c.n + 1, mine: c.mine || r.user_id === userId });
          });
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {!mine && <span className="mb-0.5 px-2 text-xs text-neutral-500">{names[m.user_id] ?? "Someone"}</span>}
              <button
                onClick={() => setOpen(open === m.id ? undefined : m.id)}
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-left ${
                  mine ? "bg-violet-600 text-white" : "bg-neutral-100 dark:bg-neutral-900"
                }`}
              >
                {m.body}
              </button>
              {counts.size > 0 && (
                <div className="mt-1 flex gap-1">
                  {[...counts].map(([emoji, c]) => (
                    <button
                      key={emoji}
                      onClick={() => react(m.id, emoji)}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.mine ? "bg-violet-200 dark:bg-violet-900" : "bg-neutral-100 dark:bg-neutral-900"
                      }`}
                    >
                      {emoji} {c.n}
                    </button>
                  ))}
                </div>
              )}
              {open === m.id && (
                <div className="mt-1 flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 dark:bg-neutral-900">
                  {EMOJI.map((e) => (
                    <button key={e} onClick={() => { react(m.id, e); setOpen(undefined); }} className="px-1 text-lg active:scale-125">
                      {e}
                    </button>
                  ))}
                  {(mine || isAdmin) && (
                    <button onClick={() => remove(m.id)} aria-label="Delete message" className="px-1 text-red-500">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          placeholder="Message"
          className="min-w-0 flex-1 rounded-full bg-neutral-100 px-4 py-3 dark:bg-neutral-900"
        />
        <button aria-label="Send" className="rounded-full bg-violet-600 p-3 text-white">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

const same = (a: Reaction, b: Reaction) =>
  a.message_id === b.message_id && a.user_id === b.user_id && a.emoji === b.emoji;
