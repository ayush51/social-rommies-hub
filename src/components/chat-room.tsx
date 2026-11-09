"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Plus, Reply, Send, SmilePlus, Trash2, X } from "lucide-react";
import { notify } from "@/app/(app)/push-actions";
import { compress } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

export type Msg = {
  id: string;
  user_id: string;
  recipient_id: string | null;
  body: string;
  image_path: string | null;
  reply_to: string | null;
  created_at: string;
};
export type Reaction = { message_id: string; user_id: string; emoji: string };

const EMOJI = ["👍", "😂", "❤️", "🔥", "😮", "😢", "🙏", "🎉"];
const COLS = "id, user_id, recipient_id, body, image_path, reply_to, created_at";

type Props = {
  householdId: string;
  userId: string;
  isAdmin: boolean;
  names: Record<string, string>;
  peerId?: string | null; // set for a DM, omitted for the group chat
  initialMessages: Msg[];
  initialReactions: Reaction[];
  initialUrls: Record<string, string>;
  className?: string;
};

const same = (a: Reaction, b: Reaction) => a.message_id === b.message_id && a.user_id === b.user_id && a.emoji === b.emoji;

export function ChatRoom({ householdId, userId, isAdmin, names, peerId = null, initialMessages, initialReactions, initialUrls, className = "" }: Props) {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState(initialMessages);
  const [reactions, setReactions] = useState(initialReactions);
  const [urls, setUrls] = useState(initialUrls);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<string>();
  const [replyTo, setReplyTo] = useState<Msg>();
  const [file, setFile] = useState<File>();
  const [tray, setTray] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const bottom = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const inRoom = (m: Msg) =>
    peerId
      ? m.recipient_id !== null && ((m.user_id === userId && m.recipient_id === peerId) || (m.user_id === peerId && m.recipient_id === userId))
      : m.recipient_id === null;

  useEffect(() => {
    const filter = `household_id=eq.${householdId}`;
    const channel = supabase
      .channel(`chat:${householdId}:${peerId ?? "group"}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter }, (p) => {
        const m = p.new as Msg;
        if (!inRoom(m)) return;
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
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, householdId, peerId, userId]);

  // sign photos that arrive after the first render
  useEffect(() => {
    const missing = [...new Set(messages.map((m) => m.image_path).filter((p): p is string => !!p && !urls[p]))];
    if (!missing.length) return;
    let cancelled = false;
    supabase.storage.from("chat").createSignedUrls(missing, 3600).then(({ data }) => {
      if (cancelled || !data) return;
      setUrls((cur) => ({ ...cur, ...Object.fromEntries(data.filter((d) => d.path && d.signedUrl).map((d) => [d.path as string, d.signedUrl as string])) }));
    });
    return () => { cancelled = true; };
  }, [messages, urls, supabase]);

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if ((!body && !file) || sending) return;
    setSending(true);
    setError(undefined);
    try {
      let image_path: string | null = null;
      if (file) {
        image_path = `${householdId}/${userId}/${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("chat").upload(image_path, await compress(file), { contentType: "image/jpeg" });
        if (error) throw error;
      }
      const { data, error } = await supabase
        .from("messages")
        .insert({ household_id: householdId, user_id: userId, body, recipient_id: peerId, image_path, reply_to: replyTo?.id ?? null })
        .select(COLS)
        .single();
      if (error) throw error;
      setMessages((cur) => (cur.some((x) => x.id === data.id) ? cur : [...cur, data]));
      setDraft("");
      setFile(undefined);
      setReplyTo(undefined);
      setTray(false);
      void notify("message", data.id);
    } catch (err) {
      setError((err as { message?: string }).message === "slow down" ? "Slow down a little." : "Message failed to send.");
    } finally {
      setSending(false);
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

  async function remove(m: Msg) {
    setMessages((cur) => cur.filter((x) => x.id !== m.id));
    await supabase.from("messages").delete().eq("id", m.id);
    if (m.image_path && m.user_id === userId) await supabase.storage.from("chat").remove([m.image_path]);
  }

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    e.target.value = "";
    setTray(false);
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && <p className="text-neutral-500">{peerId ? "No messages yet. Say hi." : "Quiet in here. Say something."}</p>}
        {messages.map((m) => {
          const mine = m.user_id === userId;
          const quoted = m.reply_to ? messages.find((x) => x.id === m.reply_to) : undefined;
          const mr = reactions.filter((r) => r.message_id === m.id);
          const chips = EMOJI.map((e) => ({ e, who: mr.filter((r) => r.emoji === e) })).filter((c) => c.who.length);
          const canDelete = mine || (isAdmin && m.recipient_id === null);
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {!mine && !peerId && <span className="mb-0.5 px-2 text-xs text-neutral-500">{names[m.user_id] ?? "Someone"}</span>}
              <div className={`flex max-w-[88%] items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                <button
                  onClick={() => setOpen(open === m.id ? undefined : m.id)}
                  className={`min-w-0 overflow-hidden whitespace-pre-wrap break-words rounded-3xl text-left ${mine ? "bg-violet-600 text-white" : "bg-neutral-100 dark:bg-neutral-900"}`}
                >
                  {m.reply_to && (
                    <span className={`mx-2 mt-2 block rounded-2xl px-3 py-1 text-xs ${mine ? "bg-violet-700/60" : "bg-neutral-200 dark:bg-neutral-800"}`}>
                      {quoted ? `${names[quoted.user_id] ?? "Someone"}: ${quoted.body || "Photo"}` : "Earlier message"}
                    </span>
                  )}
                  {m.image_path && (
                    urls[m.image_path]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={urls[m.image_path]} alt="" className="max-h-72 w-full object-cover" />
                      : <span className="block h-40 w-56 animate-pulse bg-neutral-300/50" />
                  )}
                  {m.body && <span className="block px-4 py-2">{m.body}</span>}
                </button>
                <button aria-label="React or reply" onClick={() => setOpen(open === m.id ? undefined : m.id)} className="flex h-11 w-9 shrink-0 items-center justify-center text-neutral-400">
                  <SmilePlus size={16} />
                </button>
              </div>
              {chips.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {chips.map(({ e, who }) => (
                    <button key={e} onClick={() => react(m.id, e)} className={`min-h-8 rounded-full px-3 py-1.5 text-xs ${who.some((r) => r.user_id === userId) ? "bg-violet-200 dark:bg-violet-900" : "bg-neutral-100 dark:bg-neutral-900"}`}>
                      {e} {who.length}
                    </button>
                  ))}
                </div>
              )}
              {open === m.id && (
                <div className="mt-1 max-w-full rounded-3xl bg-neutral-100 p-2 dark:bg-neutral-900">
                  <div className="flex flex-wrap items-center gap-1">
                    {EMOJI.map((e) => (
                      <button key={e} onClick={() => { react(m.id, e); setOpen(undefined); }} className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl active:scale-125 ${mr.some((r) => r.emoji === e && r.user_id === userId) ? "bg-violet-200 dark:bg-violet-900" : ""}`}>{e}</button>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-3 px-1 text-sm">
                    <button onClick={() => { setReplyTo(m); setOpen(undefined); }} className="flex min-h-11 items-center gap-1 text-neutral-600 dark:text-neutral-300"><Reply size={16} /> Reply</button>
                    {canDelete && <button onClick={() => remove(m)} className="flex min-h-11 items-center gap-1 text-red-500"><Trash2 size={16} /> Delete</button>}
                  </div>
                  {chips.length > 0 && (
                    <p className="mt-1 px-1 text-xs text-neutral-500">{chips.map(({ e, who }) => `${e} ${who.map((r) => names[r.user_id] ?? "?").join(", ")}`).join("  ·  ")}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {replyTo && (
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-neutral-100 px-3 py-2 text-xs dark:bg-neutral-900">
          <span className="truncate">Replying to {names[replyTo.user_id] ?? "someone"}: {replyTo.body || "Photo"}</span>
          <button aria-label="Cancel reply" onClick={() => setReplyTo(undefined)}><X size={14} /></button>
        </div>
      )}
      {preview && (
        <div className="mt-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          <button aria-label="Remove photo" onClick={() => setFile(undefined)} className="text-neutral-500"><X size={16} /></button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      {tray && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => camera.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-neutral-100 py-2 text-sm dark:bg-neutral-900"><Camera size={16} /> Camera</button>
          <button type="button" onClick={() => library.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-neutral-100 py-2 text-sm dark:bg-neutral-900"><ImageIcon size={16} /> Photo library</button>
        </div>
      )}
      <input ref={camera} type="file" accept="image/*" capture="environment" onChange={pick} hidden />
      <input ref={library} type="file" accept="image/*" onChange={pick} hidden />
      <form onSubmit={send} className="mt-2 flex items-center gap-2">
        <button type="button" aria-label="Add a photo" onClick={() => setTray(!tray)} className="rounded-full bg-neutral-100 p-3 dark:bg-neutral-900"><Plus size={20} /></button>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="Message" className="min-w-0 flex-1 rounded-full bg-neutral-100 px-4 py-3 dark:bg-neutral-900" />
        <button aria-label="Send" disabled={sending} className="rounded-full bg-violet-600 p-3 text-white disabled:opacity-60"><Send size={20} /></button>
      </form>
    </div>
  );
}
