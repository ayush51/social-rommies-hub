export const STATUS_PRESETS = [
  { kind: "in_bed", label: "In bed" },
  { kind: "movie", label: "Watching a movie" },
  { kind: "drinking", label: "Drinking" },
  { kind: "work", label: "Busy at work" },
  { kind: "gaming", label: "Gaming" },
  { kind: "living_room", label: "Come to the living room" },
  { kind: "cooking", label: "Cooking" },
  { kind: "hangout", label: "Available to hang out" },
] as const;

export const EXPIRY_OPTIONS = [
  { value: "0", label: "No expiry" },
  { value: "1", label: "1 hour" },
  { value: "3", label: "3 hours" },
  { value: "8", label: "8 hours" },
] as const;
