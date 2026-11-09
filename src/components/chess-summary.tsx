import Link from "next/link";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Games-page / Home card: links to chess and shows how many games are waiting on my move.
export async function ChessSummary() {
  const me = await getMe();
  const supabase = await createClient();
  const { data } = await supabase.from("chess_games").select("white_id, black_id, turn").eq("status", "playing");
  const waiting = (data ?? []).filter((g) => (g.turn === "w" ? g.white_id : g.black_id) === me.userId).length;
  return (
    <Link href="/games/chess" className="mt-3 flex min-h-11 items-center justify-between rounded-3xl bg-neutral-100 px-5 py-4 dark:bg-neutral-900">
      <span className="font-semibold">Chess</span>
      <span className={`text-sm ${waiting ? "font-semibold text-violet-600 dark:text-violet-400" : "text-neutral-500"}`}>
        {waiting ? `${waiting} ${waiting === 1 ? "game waiting" : "games waiting"} on you` : "Play a roommate"}
      </span>
    </Link>
  );
}
