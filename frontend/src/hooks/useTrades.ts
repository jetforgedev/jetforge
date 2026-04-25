"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getTrades, TradeData } from "@/lib/api";
import { useSocket } from "@/hooks/useLiveFeed";

export function useTrades(mint: string) {
  const [liveTrades, setLiveTrades] = useState<TradeData[]>([]);
  const queryClient = useQueryClient();
  const socket = useSocket();

  const query = useQuery({
    queryKey: ["trades", mint],
    queryFn: () => getTrades(mint, 1, 50),
    enabled: !!mint,
    staleTime: 10_000,
    refetchInterval: 15_000, // Periodic resync so trades stay current even if socket misses an event
  });

  useEffect(() => {
    if (!socket || !mint) return;

    socket.emit("subscribe:token", mint);
    // Re-subscribe on reconnect — server drops room membership on every new
    // connection; the singleton socket never changes reference so effects
    // don't re-run automatically.
    const onReconnect = () => socket.emit("subscribe:token", mint);
    socket.on("connect", onReconnect);

    // Named handler so .off() only removes this component's listener —
    // NOT every new_trade listener registered by other components (PriceChart, etc.).
    const onNewTrade = (trade: any) => {
      if (trade.mint === mint) {
        const newTrade: TradeData = {
          id: `live-${trade.signature || Date.now()}`,
          signature: trade.signature || "",
          mint: trade.mint,
          trader: trade.trader,
          type: trade.type,
          solAmount: trade.solAmount,
          tokenAmount: trade.tokenAmount,
          price: trade.price,
          fee: "0",
          timestamp: new Date(trade.timestamp * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        };

        setLiveTrades((prev) => {
          // Deduplicate by signature before adding
          if (trade.signature && prev.some((t) => t.signature === trade.signature)) return prev;
          return [newTrade, ...prev].slice(0, 100);
        });
      }
    };

    socket.on("new_trade", onNewTrade);

    return () => {
      // Do NOT emit unsubscribe:token here — the socket is shared globally.
      // PriceChart (and potentially other components) may still be subscribed
      // to this room; unsubscribing would remove the socket from the room for
      // ALL components, silencing new_trade events for everyone.
      socket.off("connect", onReconnect);
      socket.off("new_trade", onNewTrade);
    };
  }, [socket, mint, queryClient]);

  // Merge live trades with fetched trades, deduplicating by signature or compound key
  const allTrades = (() => {
    const fetched = query.data?.trades || [];
    // Build a set of keys from live trades to filter duplicates out of fetched results
    // Use signature if available, otherwise fall back to trader+type+solAmount
    const liveKeys = new Set(
      liveTrades.map((t) =>
        t.signature ? t.signature : `${t.trader}:${t.type}:${t.solAmount}`
      )
    );
    const filteredFetched = fetched.filter((t) => {
      const key = t.signature ? t.signature : `${t.trader}:${t.type}:${t.solAmount}`;
      return !liveKeys.has(key);
    });
    return [...liveTrades, ...filteredFetched];
  })();

  return {
    ...query,
    trades: allTrades,
    liveTradeCount: liveTrades.length, // socket-only count since mount — not inflated by fetch
  };
}
