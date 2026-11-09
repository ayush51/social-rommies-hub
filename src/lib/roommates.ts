// Used only until the live roster loads on the login screen.
export const FALLBACK_ROSTER = ["Jay", "Micah", "Tyler", "Ayush", "Jesse", "Kelly"];

// Accounts are code-only; the email is a login handle, never mailed.
export const loginEmail = (name: string) => `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@abingdon.example.com`;
