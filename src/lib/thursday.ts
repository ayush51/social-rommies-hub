export type ThursdayPoll = {
  phase: "open" | "locked" | "done";
  week_start: string;
  lock_at: string;
  cook_day: string;
  cook_name: string;
  lock_dow: number;
  lock_time: string;
  total_votes: number;
  members: number;
  my_vote: string | null;
  winner: { id: string; name: string; votes: number } | null;
  dishes: { id: string; name: string; votes: number }[];
};
