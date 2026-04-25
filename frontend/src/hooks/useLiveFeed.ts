"use client";

import { useEffect, useState, useRef, createContext, useContext } from "react";
import { io, Socket } from "socket.io-client";
import { getRecentTrades } from "@/lib/api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

// Global socket context
const SocketContext = createContext<Socket | null>(null);

let globalSocket: Socket | null = null;

export function getGlobalSocket(): Socket {
  if (!globalSocket || !globalSocket.connected) {
    globalSocket = io(WS_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return globalSocket;
}

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = getGlobalSocket();
    setSocket(s);

    return () => {
      // Don't disconnect on component unmount - keep global connection
    };
  }, []);

  return socket;
}

export interface FeedItem {
  id: string;
  type: "BUY" | "SELL" | "TOKEN_CREATED" | "GRADUATED";
  mint: string;
  trader?: string;
  solAmount?: string;
  tokenAmount?: string;
  price?: number;
  tokenName?: string;
  tokenSymbol?: string;
  tokenImageUrl?: string;
  timestamp: number;
}

export function useLiveFeed(maxItems = 50) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socket = useSocket();

  // Seed feed with recent trades from DB on mount
  useEffect(() => {
    getRecentTrades(20).then(({ trades }) => {
      const items: FeedItem[] = trades.map((t) => ({
        id: t.id,
        type: t.type as "BUY" | "SELL",
        mint: t.mint,
        trader: t.trader,
        solAmount: t.solAmount,
        tokenAmount: t.tokenAmount,
        price: t.price,
        tokenName: t.tokenName,
        tokenSymbol: t.tokenSymbol,
        tokenImageUrl: t.tokenImageUrl,
        timestamp: t.timestamp,
      }));
      setFeed(items);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.emit("subscribe:feed");
    setIsConnected(socket.connected);

    const handleConnect = () => {
      // Re-subscribe on every (re)connect — server drops rooms on disconnect.
      // The singleton socket never changes reference so this effect doesn't
      // re-run automatically after a reconnect.
      socket.emit("subscribe:feed");
      setIsConnected(true);
    };
    const handleDisconnect = () => setIsConnected(false);

    const handleFeedTrade = (data: any) => {
      const item: FeedItem = {
        id: `${data.mint}-${data.timestamp}-${Math.random()}`,
        type: data.type,
        mint: data.mint,
        trader: data.trader,
        solAmount: data.solAmount,
        tokenAmount: data.tokenAmount,
        price: data.price,
        tokenName: data.tokenName,
        tokenSymbol: data.tokenSymbol,
        tokenImageUrl: data.tokenImageUrl,
        timestamp: data.timestamp,
      };
      setFeed((prev) => {
        if (prev.some((x) => x.id === item.id)) return prev;
        return [item, ...prev].slice(0, maxItems);
      });
    };

    const handleTokenCreated = (data: any) => {
      const item: FeedItem = {
        id: `created-${data.mint}-${Date.now()}`,
        type: "TOKEN_CREATED",
        mint: data.mint,
        trader: data.creator,
        tokenName: data.name,
        tokenSymbol: data.symbol,
        tokenImageUrl: data.imageUrl,
        timestamp: data.timestamp,
      };
      setFeed((prev) => [item, ...prev].slice(0, maxItems));
    };

    const handleGraduation = (data: any) => {
      const item: FeedItem = {
        id: `grad-${data.mint}-${Date.now()}`,
        type: "GRADUATED",
        mint: data.mint,
        tokenName: data.tokenName,
        timestamp: data.timestamp,
      };
      setFeed((prev) => [item, ...prev].slice(0, maxItems));
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("feed_trade", handleFeedTrade);
    socket.on("token_created", handleTokenCreated);
    socket.on("token_graduated", handleGraduation);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("feed_trade", handleFeedTrade);
      socket.off("token_created", handleTokenCreated);
      socket.off("token_graduated", handleGraduation);
    };
  }, [socket, maxItems]);

  return { feed, isConnected };
}
