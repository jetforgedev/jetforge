import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { config } from "../config";

export interface TradeEvent {
  type: "BUY" | "SELL";
  mint: string;
  trader: string;
  signature: string;
  solAmount: string;
  tokenAmount: string;
  price: number;
  virtualSolReserves: string;
  virtualTokenReserves: string;
  realSolReserves: string;
  timestamp: number;
  tokenName?: string;
  tokenSymbol?: string;
  tokenImageUrl?: string;
  // Post-DB stats — available after the write, used to update home page caches instantly
  volume24h?: number;
  trades?: number;
  holders?: number;
}

export interface TokenCreatedEvent {
  mint: string;
  creator: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  timestamp: number;
}

export interface PriceUpdateEvent {
  mint: string;
  price: number;
  virtualSolReserves: string;
  virtualTokenReserves: string;
  realSolReserves: string;
  marketCapSol: number;
  graduationProgress: number;
  timestamp: number;
}

export interface GraduationEvent {
  mint: string;
  creator: string;
  totalVolumeSol: string;
  totalTrades: string;
  timestamp: number;
}

export function initWebSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.frontendUrl,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a token-specific room
    socket.on("subscribe:token", (mint: string) => {
      if (typeof mint === "string" && mint.length >= 32) {
        socket.join(`token:${mint}`);
        console.log(`Socket ${socket.id} subscribed to token: ${mint}`);
      }
    });

    // Leave a token-specific room
    socket.on("unsubscribe:token", (mint: string) => {
      socket.leave(`token:${mint}`);
      console.log(`Socket ${socket.id} unsubscribed from token: ${mint}`);
    });

    // Join global live feed
    socket.on("subscribe:feed", () => {
      socket.join("global:feed");
      console.log(`Socket ${socket.id} joined global feed`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    socket.on("error", (err) => {
      console.error(`Socket error for ${socket.id}:`, err);
    });
  });

  return io;
}

// Broadcast helpers
export function broadcastTrade(io: Server, event: TradeEvent): void {
  // Send to token-specific room
  io.to(`token:${event.mint}`).emit("new_trade", event);

  // Send to global feed — includes post-DB stats so home page caches
  // (volume24h, trades count, holders) all update from the same event.
  io.to("global:feed").emit("feed_trade", {
    type: event.type,
    mint: event.mint,
    trader: event.trader,
    signature: event.signature,
    solAmount: event.solAmount,
    tokenAmount: event.tokenAmount,
    price: event.price,
    tokenName: event.tokenName,
    tokenSymbol: event.tokenSymbol,
    tokenImageUrl: event.tokenImageUrl,
    timestamp: event.timestamp,
    volume24h: event.volume24h,
    trades: event.trades,
    holders: event.holders,
  });
}

export function broadcastPriceUpdate(io: Server, event: PriceUpdateEvent): void {
  // Token-specific room — PriceChart, useTokenData, etc.
  io.to(`token:${event.mint}`).emit("price_update", event);
  // Global feed room — home page token cards need live graduation progress
  // and market cap without subscribing to individual token rooms.
  io.to("global:feed").emit("feed_price_update", {
    mint: event.mint,
    marketCapSol: event.marketCapSol,
    graduationProgress: event.graduationProgress,
    realSolReserves: event.realSolReserves,
  });
}

export function broadcastTokenCreated(io: Server, event: TokenCreatedEvent): void {
  io.to("global:feed").emit("token_created", event);
}

export function broadcastGraduation(io: Server, event: GraduationEvent): void {
  io.to(`token:${event.mint}`).emit("token_graduated", event);
  io.to("global:feed").emit("token_graduated", event);
}

export function broadcastComment(io: Server, comment: { id: string; mint: string; wallet: string; text: string; createdAt: Date }): void {
  io.to(`token:${comment.mint}`).emit("new_comment", {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
  });
}
