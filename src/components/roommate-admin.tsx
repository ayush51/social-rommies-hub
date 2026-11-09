"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const field = "h-11 rounded-2xl bg-white px-3 text-sm dark:bg-neutral-800";
const friendly = (m: string) => m.replace(/^.*?: /, "");

export function RoommateRow({ id, name, role }: { id: string; name: string; role: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();
  const supabase = createClient();

  const run = (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) =>
    start(async () => {
      const { error } = await fn();
      setMsg(error ? { ok: false, text: friendly(error.message) } : { ok: true, text: ok });
      if (!error) { setCode(""); setOpen(false); }
      router.refresh();
    });

  return (
    <li className="rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{name} <span className="ml-1 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-normal dark:bg-neutral-800">{role}</span></p>
        <div className="flex gap-1">
          <button disabled={pending} onClick={() => run(() => supabase.rpc("set_member_role", { p_user: id, p_role: role === "admin" ? "member" : "admin" }), "Role updated.")} className="min-h-11 rounded-2xl px-3 text-sm text-violet-600 underline dark:text-violet-400">{role === "admin" ? "Make member" : "Make admin"}</button>
          <button onClick={() => setOpen(!open)} className="min-h-11 rounded-2xl px-3 text-sm text-neutral-500 underline">Reset code</button>
        </div>
      </div>
      {open && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => supabase.rpc("admin_reset_code", { p_user: id, p_code: code }), `New code set for ${name}. Tell them privately; they were signed out.`); }} className="mt-3 flex gap-2">
          <input aria-label={`New code for ${name}`} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6 digits" className={`${field} min-w-0 flex-1`} />
          <button disabled={pending || code.length !== 6} className="min-h-11 rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Set</button>
        </form>
      )}
      {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
    </li>
  );
}

export function AddRoommate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const { error } = await createClient().rpc("admin_add_roommate", { p_name: name, p_code: code });
          setMsg(error ? { ok: false, text: friendly(error.message) } : { ok: true, text: `${name} added. Give them their code privately.` });
          if (!error) { setName(""); setCode(""); }
          router.refresh();
        });
      }}
      className="space-y-2 rounded-3xl bg-neutral-100 p-4 dark:bg-neutral-900"
    >
      <h2 className="font-semibold">Add a roommate</h2>
      <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Name (letters and numbers)" className={`${field} w-full`} />
      <input aria-label="Starting code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="Their 6-digit code" className={`${field} w-full`} />
      <button disabled={pending || !name || code.length !== 6} className="min-h-11 w-full rounded-2xl bg-violet-600 text-sm font-semibold text-white disabled:opacity-50">Add roommate</button>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
    </form>
  );
}
