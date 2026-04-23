import { useQuery } from "@tanstack/react-query";

/**
 * Shared hook: fetches SOL/USD from CoinGecko, cached 60 s.
 * Used by portfolio, leaderboard, creators, and token pages.
 * Returns null when unavailable — callers must handle gracefully.
 */
export function useSolPrice(): number | null {
  const { data } = useQuery<number | null>({
    queryKey: ["sol-price"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      );
      const json = await res.json();
      return json?.solana?.usd ?? null;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  return data ?? null;
}

/**
 * Format a SOL amount as a USD sub-line string.
 * Returns null when solPrice is unavailable — callers should hide the element.
 */
export function solToUsd(sol: number, solPrice: number | null): string | null {
  if (!solPrice || !isFinite(sol)) return null;
  const usd = Math.abs(sol) * solPrice;
  return `≈ $${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
