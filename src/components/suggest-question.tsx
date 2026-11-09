"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const PREFIX = "Who's most likely to";

export function SuggestQuestion() {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const { error } = await createClient().rpc("suggest_question", { p_text: `${PREFIX} ${text.trim()}` });
      setMsg(
        !error ? "Sent. If Ayush approves it, it becomes a daily card."
        : error.message.includes("slow down") ? "That's 5 for today. Try tomorrow."
        : error.message.includes("already") ? "Someone already suggested that one."
        : "Make it a bit longer.",
      );
      if (!error) setText("");
    });

  return (
    <details className="mt-3 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <summary className="cursor-pointer text-sm font-semibold">Suggest a question</summary>
      <p className="mt-2 text-sm text-neutral-500">{PREFIX}…</p>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim().length > 2) send(); }} className="mt-1 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={110} placeholder="eat the last slice and blame the dog?" className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2 text-sm dark:bg-neutral-800" />
        <button disabled={pending || text.trim().length < 3} className="rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Send</button>
      </form>
      {msg && <p className="mt-2 text-sm text-neutral-500">{msg}</p>}
    </details>
  );
}
