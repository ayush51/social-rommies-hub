"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const weak = (c: string) => /^(\d)\1{5}$/.test(c) || "0123456789".includes(c) || "9876543210".includes(c);
const field = "mt-1 h-11 w-full rounded-2xl bg-neutral-100 px-3 text-center text-lg tracking-[0.4em] dark:bg-neutral-900";

export function ChangeCodeForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      if (!/^\d{6}$/.test(next)) return setMsg({ ok: false, text: "Your new code must be 6 digits." });
      if (weak(next)) return setMsg({ ok: false, text: "Pick something less guessable than that." });
      if (next !== again) return setMsg({ ok: false, text: "The two new codes don't match." });
      if (next === current) return setMsg({ ok: false, text: "That's your current code." });
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const verify = await supabase.auth.signInWithPassword({ email: data.user?.email ?? "", password: current });
      if (verify.error) return setMsg({ ok: false, text: "Your current code is wrong." });
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) return setMsg({ ok: false, text: "Couldn't change it. Try again." });
      await supabase.auth.signOut({ scope: "others" });
      setCurrent(""); setNext(""); setAgain("");
      setMsg({ ok: true, text: "Done. Use the new code next time you log in. Other devices were signed out." });
    });

  return (
    <div className="space-y-3">
      {([["Current code", current, setCurrent, "current-password"], ["New code", next, setNext, "new-password"], ["New code again", again, setAgain, "new-password"]] as const).map(([label, value, set, auto]) => (
        <label key={label} className="block text-xs font-semibold">
          {label}
          <input type="password" inputMode="numeric" maxLength={6} autoComplete={auto} value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ""))} className={field} />
        </label>
      ))}
      <button disabled={pending} onClick={submit} className="min-h-11 w-full rounded-2xl bg-violet-600 py-3 font-semibold text-white disabled:opacity-60">Change my code</button>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
    </div>
  );
}
