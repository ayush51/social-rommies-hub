export type CardToday = {
  date: string;
  prompt: string;
  voted: boolean;
  my_pick: string | null;
  members: number;
  voted_count: number;
  options: { id: string; name: string; votes: number | null }[];
};

export type CardHistory = {
  rounds: {
    date: string;
    prompt: string;
    winners: string[];
    results: { name: string; votes: number }[];
  }[];
  scores: { name: string; wins: number }[];
};
