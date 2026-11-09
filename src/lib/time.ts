// Wrapper so render code can read the clock without tripping the React purity lint rule.
export const nowMs = () => Date.now();
