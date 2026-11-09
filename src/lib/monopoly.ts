export const SEAT_COLORS = ["#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];

export const GROUP_COLORS: Record<string, string> = {
  brown: "#8b5a2b",
  lightblue: "#7dd3fc",
  pink: "#f472b6",
  orange: "#fb923c",
  red: "#ef4444",
  yellow: "#facc15",
  green: "#22c55e",
  blue: "#2563eb",
};

export type Space = {
  idx: number;
  kind: string;
  name: string;
  color: string | null;
  price: number | null;
  rent: number[] | null;
  upgrade_cost: number | null;
  amount: number | null;
};

export type BoardPlayer = { user_id: string; seat: number; name: string; position: number; bankrupt: boolean };
export type BoardProp = { space: number; owner_id: string; level: number };

// Grid cell (1-based row/col on an 11x11 ring) for each of the 40 spaces.
export function cellFor(idx: number): { row: number; col: number } {
  if (idx <= 10) return { row: 11, col: 11 - idx };
  if (idx <= 20) return { row: 11 - (idx - 10), col: 1 };
  if (idx <= 30) return { row: 1, col: 1 + (idx - 20) };
  return { row: 1 + (idx - 30), col: 11 };
}

export const ICON: Record<string, string> = { start: "GO", jail: "Couch", parking: "Free", gotojail: "To Couch", tax: "Tax", card: "?", station: "Line", utility: "Util" };
