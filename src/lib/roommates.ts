export const ROOMMATES = ["Jay", "Micah", "Tyler", "Ayush", "Jesse", "Kelly"] as const;

export type Roommate = (typeof ROOMMATES)[number];

// Accounts are PIN-only; the email is a login handle, never mailed.
export const loginEmail = (name: Roommate) => `${name.toLowerCase()}@abingdon.example.com`;
