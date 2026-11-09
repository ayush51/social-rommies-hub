import Link from "next/link";
import { Confetti } from "@/components/confetti";
import { DishVote } from "@/components/dish-vote";
import { LocalTime } from "@/components/local-time";
import { PollAdmin } from "@/components/poll-admin";
import type { ThursdayPoll } from "@/lib/thursday";
import { getMe } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function ThursdayPage() {
  const me = await getMe();
  const supabase = await createClient();
  const { data: raw } = await supabase.rpc("thursday_poll");
  const poll = raw as unknown as ThursdayPoll;
  const { data: allDishes } = me.isAdmin
    ? await supabase.from("dishes").select("id, name, active").order("name")
    : { data: [] };

  return (
    <>
      <Link href="/" className="text-sm text-violet-600 dark:text-violet-400">Home</Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Thirsty Thursday</h1>

      {poll.phase === "open" && (
        <p className="mt-1 text-neutral-500">
          What should {poll.cook_name} cook? Voting closes <LocalTime iso={poll.lock_at} />. {poll.total_votes} of {poll.members} voted. Voting earns 5 Abby Coins.
        </p>
      )}
      {poll.phase !== "open" && poll.winner && (
        <section className="mt-4 rounded-3xl bg-violet-600 p-5 text-white">
          <Confetti storageKey={`thursday-confetti:${poll.week_start}`} />
          <p className="text-sm text-violet-100">{poll.phase === "locked" ? "This Thursday" : "Last Thursday"}</p>
          <p className="mt-1 text-2xl font-bold">{poll.cook_name} is making {poll.winner.name}</p>
          <p className="mt-1 text-sm text-violet-100">{poll.winner.votes} {poll.winner.votes === 1 ? "vote" : "votes"}</p>
        </section>
      )}
      {poll.phase === "locked" && !poll.winner && <p className="mt-1 text-neutral-500">Nobody voted this week.</p>}
      {poll.phase === "done" && <p className="mt-1 text-sm text-neutral-500">The next poll opens Tuesday.</p>}

      {poll.dishes.length > 0 ? (
        <div className="mt-4">
          <DishVote poll={poll} />
        </div>
      ) : (
        <p className="mt-4 text-neutral-500">No dishes yet.{me.isAdmin ? " Add some below." : " Ask an admin to add some."}</p>
      )}

      {me.isAdmin && <PollAdmin householdId={me.householdId} dishes={allDishes ?? []} poll={poll} />}
    </>
  );
}
