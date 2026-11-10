export type CardToday = {
  date: string;
  prompt: string;
  suggested_by: string | null;
  voted: boolean;
  my_pick: string | null;
  me: string;
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

export type CardPast = {
  date: string;
  prompt: string;
  suggested_by: string | null;
  winners: string[];
  voted_count: number;
}[];
