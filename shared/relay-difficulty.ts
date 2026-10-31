export const relayOperationCounts = [2, 3, 5, 6, 7] as const;
export function relayOperationCount(level: number) { return relayOperationCounts[Math.max(0, Math.min(4, Math.trunc(level) - 1))]; }
