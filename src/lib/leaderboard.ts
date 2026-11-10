export type LeaderRow = { user_id: string; name: string; avatar: string | null; badge: string | null; balance: number; week: number };

// Competition ranking: people with the same balance share a rank (1, 2, 2, 4).
export const ranked = (rows: LeaderRow[]) => rows.map((r) => ({ ...r, rank: 1 + rows.filter((x) => x.balance > r.balance).length }));
