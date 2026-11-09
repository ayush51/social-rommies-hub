"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Unread = { group: number; dms: Record<string, number>; total: number };
const EMPTY: Unread = { group: 0, dms: {}, total: 0 };

// Call after reading a thread so badges elsewhere refresh at once.
export const announceRead = () => window.dispatchEvent(new Event("chat-read"));

export function useUnread() {
  const [unread, setUnread] = useState<Unread>(EMPTY);
  const load = useCallback(async () => {
    const { data } = await createClient().rpc("chat_unread");
    if (data) setUnread(data as unknown as Unread);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(load, 400); };
    const first = setTimeout(load, 0);
    const channel = supabase
      .channel(`unread:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, soon)
      .subscribe();
    const onVisible = () => document.visibilityState === "visible" && soon();
    window.addEventListener("chat-read", soon);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearTimeout(timer);
      supabase.removeChannel(channel);
      window.removeEventListener("chat-read", soon);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return unread;
}
