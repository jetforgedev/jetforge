"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getToken, getTokens, TokenData } from "@/lib/api";
import { useSocket } from "@/hooks/useLiveFeed";

export function useToken(mint: string) {
  const queryClient = useQueryClient();
  const socket = useSocket();

  // Throttle reference: don't hammer holders/dev-holdings on every trade
  const lastHoldersInvalidate = useRef(0);

  const query = useQuery({
    queryKey: ["token", mint],
    queryFn: () => getToken(mint),
    enabled: !!mint,
    refetchInterval: (query) => {
      if (query.state.status === "error") return 3_000;
      // Poll fast (5s) for active tokens so graduation + trades show quickly.
      // After graduation, slow down to 30s.
      const data = query.state.data as TokenData | undefined;
      return data?.isGraduated ? 30_000 : 5_000;
    },
    staleTime: 4_000,
    retry: 60, // Keep retrying (3s interval × 60 = 3 min max)
    retryDelay: 3_000,
  });

  useEffect(() => {
    if (!socket || !mint) return;

    // Subscribe to token-specific updates
    socket.emit("subscribe:token", mint);

    // ── price_update: update reserves, market cap, graduation progress ─────────
    // Uses a named function so cleanup only removes this component's listener.
    const onPriceUpdate = (data: any) => {
      if (data.mint !== mint) return;
      queryClient.setQueryData<TokenData>(["token", mint], (old) => {
        if (!old) return old;
        return {
          ...old,
          virtualSolReserves: data.virtualSolReserves,
          virtualTokenReserves: data.virtualTokenReserves,
          realSolReserves: data.realSolReserves,
          marketCapSol: data.marketCapSol,
          graduationProgress: data.graduationProgress,
        };
      });
    };

    // ── new_trade: patch the trade counter + throttled invalidation of
    //    holders and dev-holdings so those sections stay current ──────────────
    const onNewTrade = (data: any) => {
      if (data.mint !== mint) return;

      // Immediately bump the displayed trade count by 1 — avoids waiting for
      // the next 5 s polling cycle to see the number advance.
      queryClient.setQueryData<TokenData>(["token", mint], (old) => {
        if (!old) return old;
        return { ...old, trades: (old.trades ?? 0) + 1 };
      });

      // Throttle holders + dev-holdings refetch to at most once every 8 s.
      // On the first trade after page load (or after the last refetch) we fire
      // immediately; subsequent trades within the window are coalesced.
      const now = Date.now();
      if (now - lastHoldersInvalidate.current > 2_000) {
        lastHoldersInvalidate.current = now;
        // Invalidate by prefix so all dev-holdings keys for this mint match
        // regardless of which creator address was passed.
        queryClient.invalidateQueries({ queryKey: ["holders", mint] });
        queryClient.invalidateQueries({ queryKey: ["dev-holdings", mint] });
      }
    };

    // ── token_graduated: mark graduated + full refetch ───────────────────────
    const onTokenGraduated = (data: any) => {
      if (data.mint !== mint) return;
      queryClient.setQueryData<TokenData>(["token", mint], (old) => {
        if (!old) return old;
        return { ...old, isGraduated: true };
      });
      queryClient.invalidateQueries({ queryKey: ["token", mint] });
    };

    socket.on("price_update", onPriceUpdate);
    socket.on("new_trade", onNewTrade);
    socket.on("token_graduated", onTokenGraduated);

    return () => {
      socket.emit("unsubscribe:token", mint);
      // Use the named handlers so we only remove our own listeners —
      // NOT all listeners for these events (PriceChart etc. register their own).
      socket.off("price_update", onPriceUpdate);
      socket.off("new_trade", onNewTrade);
      socket.off("token_graduated", onTokenGraduated);
    };
  }, [socket, mint, queryClient]);

  return query;
}

export function useTokenList(
  sort: "trending" | "new" | "graduating" | "graduated" = "new",
  page = 1
) {
  return useQuery({
    queryKey: ["tokens", sort, page],
    queryFn: () => getTokens(sort, page),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
