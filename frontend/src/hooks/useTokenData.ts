"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getToken, getTokens, TokenData } from "@/lib/api";
import { useSocket } from "@/hooks/useLiveFeed";

export function useToken(mint: string) {
  const queryClient = useQueryClient();
  const socket = useSocket();


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

    // Subscribe to token-specific updates.
    // Also re-subscribe on every reconnect — socket.io rooms are per-connection;
    // after a reconnect the server drops the client from all rooms and the
    // singleton socket object never changes reference, so React effects don't
    // re-run. Listening for "connect" (fires on initial connect + every
    // reconnect) and re-emitting keeps the subscription alive automatically.
    socket.emit("subscribe:token", mint);
    const onReconnect = () => socket.emit("subscribe:token", mint);
    socket.on("connect", onReconnect);

    // ── price_update: update reserves, market cap, graduation progress ─────────
    // Uses a named function so cleanup only removes this component's listener.
    const onPriceUpdate = (data: any) => {
      if (data.mint !== mint) return;
      // Cancel any in-flight REST poll before patching.  The 5-second polling
      // cycle can arrive with stale DB data if the backend broadcasts the socket
      // event before the DB write commits, causing the bonding-curve bar and
      // market cap to momentarily revert.  Cancelling discards that stale
      // response; the next scheduled poll (5 s later) will have fresh data.
      queryClient.cancelQueries({ queryKey: ["token", mint] });
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

    // ── new_trade: patch the trade counter + invalidate holders/dev-holdings ──
    const onNewTrade = (data: any) => {
      if (data.mint !== mint) return;

      // Immediately bump the displayed trade count by 1 — avoids waiting for
      // the next 5 s polling cycle to see the number advance.
      queryClient.setQueryData<TokenData>(["token", mint], (old) => {
        if (!old) return old;
        return { ...old, trades: (old.trades ?? 0) + 1 };
      });

      // Invalidate on every trade — React Query deduplicates concurrent
      // in-flight requests internally so this is safe to call unconditionally.
      // Prefix match covers all dev-holdings keys regardless of creator address.
      queryClient.invalidateQueries({ queryKey: ["holders", mint] });
      queryClient.invalidateQueries({ queryKey: ["dev-holdings", mint] });
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
      // Do NOT emit unsubscribe:token here — the socket is a global singleton
      // shared by all components on this page (PriceChart, useTrades, TradingPanel,
      // etc.). Emitting unsubscribe would remove the socket from the server room
      // for ALL components, silencing every price_update / new_trade /
      // token_graduated event for the lifetime of the page visit.
      socket.off("connect", onReconnect);
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
