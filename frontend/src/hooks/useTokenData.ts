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

    // Subscribe to token-specific updates
    socket.emit("subscribe:token", mint);

    socket.on("price_update", (data: any) => {
      if (data.mint === mint) {
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
      }
    });

    socket.on("token_graduated", (data: any) => {
      if (data.mint === mint) {
        queryClient.setQueryData<TokenData>(["token", mint], (old) => {
          if (!old) return old;
          return { ...old, isGraduated: true };
        });
        queryClient.invalidateQueries({ queryKey: ["token", mint] });
      }
    });

    return () => {
      socket.emit("unsubscribe:token", mint);
      socket.off("price_update");
      socket.off("token_graduated");
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
