"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Table = "messages" | "daily_posts" | "post_comments" | "plan_comments" | "feature_comments";

// Two-tap delete for moderation lists. Storage files (photos) are removed with the row.
export function DeleteRow({ table, id, files = [], bucket }: { table: Table; id: string; files?: string[]; bucket?: "daily" | "chat" }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [error, setError] = useState(false);
  return (
    <button
      onClick={async () => {
        if (!sure) return setSure(true);
        const supabase = createClient();
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) return setError(true);
        if (bucket && files.length) await supabase.storage.from(bucket).remove(files);
        router.refresh();
      }}
      className={`flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm ${sure || error ? "text-red-500" : "text-neutral-500"}`}
    >
      <Trash2 size={14} /> {error ? "Failed" : sure ? "Confirm" : "Delete"}
    </button>
  );
}
