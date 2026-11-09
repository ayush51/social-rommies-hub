"use client";

import { useActionState, useState } from "react";
import { ROOMMATES, type Roommate } from "@/lib/roommates";
import { signIn, type LoginState } from "./actions";

export default function LoginPage() {
  const [name, setName] = useState<Roommate>();
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Abingdon Bros</h1>
        <p className="mt-1 text-neutral-500">Who&apos;s home?</p>
      </div>
      {!name ? (
        <div className="grid grid-cols-2 gap-3">
          {ROOMMATES.map((n) => (
            <button
              key={n}
              onClick={() => setName(n)}
              className="rounded-3xl bg-neutral-100 py-6 text-lg font-semibold active:scale-95 dark:bg-neutral-900"
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="name" value={name} />
          <label className="font-semibold">Hey {name}, enter your PIN</label>
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            autoComplete="current-password"
            className="rounded-2xl border border-neutral-300 bg-transparent px-4 py-3 text-center text-2xl tracking-[0.5em] dark:border-neutral-700"
          />
          <button disabled={pending} className="rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
            {pending ? "Signing in…" : "Let me in"}
          </button>
          {state.error && <p className="text-sm text-red-500">{state.error}</p>}
          <button type="button" onClick={() => setName(undefined)} className="text-sm text-neutral-500">
            Not {name}?
          </button>
        </form>
      )}
    </main>
  );
}
