// Shared in-memory cache for the /tokens/:mint/holders endpoint.
// Imported by both tokens.ts (reads) and the indexer (invalidates after trades).
// Keeping it in a standalone module avoids circular import between those two.

export const holdersCache = new Map<string, { data: any; ts: number }>();

// 2-second TTL — short enough to feel live, long enough to absorb burst reads
// (multiple clients all requesting holders right after a trade socket event).
// The indexer calls holdersCache.delete(mint) immediately on each trade so the
// very next request always gets a fresh DB read.
export const HOLDERS_TTL = 2_000;
