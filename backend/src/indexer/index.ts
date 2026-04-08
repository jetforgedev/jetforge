import {
  Connection,
  PublicKey,
  Logs,
  Context,
} from "@solana/web3.js";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { Server } from "socket.io";
import { prisma } from "../index";
import { config, BONDING_CURVE_CONSTANTS } from "../config";
import {
  broadcastTrade,
  broadcastPriceUpdate,
  broadcastTokenCreated,
  broadcastGraduation,
} from "../websocket/index";
import { createRaydiumPool } from "../services/raydiumService";
import { callGraduateInstruction } from "../services/graduateKeeper";

const PROGRAM_ID = new PublicKey(config.solana.programId);
const GRADUATION_THRESHOLD = Number(BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD);

let connection: Connection;
let subscriptionId: number | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

// ─── Minimal IDL for Anchor EventParser ────────────────────────────────────────
// Must match the on-chain program's event definitions exactly.
const IDL: any = {
  version: "0.1.0",
  name: "token_launch",
  instructions: [],
  accounts: [],
  events: [
    {
      name: "BuyEvent",
      fields: [
        { name: "mint",                 type: "publicKey", index: false },
        { name: "buyer",                type: "publicKey", index: false },
        { name: "solAmount",            type: "u64",       index: false },
        { name: "tokenAmount",          type: "u64",       index: false },
        { name: "virtualSolReserves",   type: "u64",       index: false },
        { name: "virtualTokenReserves", type: "u64",       index: false },
        { name: "realSolReserves",      type: "u64",       index: false },
        { name: "realTokenReserves",    type: "u64",       index: false },
        { name: "fee",                  type: "u64",       index: false },
        { name: "isGraduated",          type: "bool",      index: false },
        { name: "timestamp",            type: "i64",       index: false },
      ],
    },
    {
      name: "SellEvent",
      fields: [
        { name: "mint",                 type: "publicKey", index: false },
        { name: "seller",               type: "publicKey", index: false },
        { name: "tokenAmount",          type: "u64",       index: false },
        { name: "solAmount",            type: "u64",       index: false },
        { name: "virtualSolReserves",   type: "u64",       index: false },
        { name: "virtualTokenReserves", type: "u64",       index: false },
        { name: "realSolReserves",      type: "u64",       index: false },
        { name: "realTokenReserves",    type: "u64",       index: false },
        { name: "fee",                  type: "u64",       index: false },
        { name: "timestamp",            type: "i64",       index: false },
      ],
    },
    {
      name: "TokenCreatedEvent",
      fields: [
        { name: "mint",                 type: "publicKey", index: false },
        { name: "creator",              type: "publicKey", index: false },
        { name: "name",                 type: "string",    index: false },
        { name: "symbol",               type: "string",    index: false },
        { name: "uri",                  type: "string",    index: false },
        { name: "virtualSolReserves",   type: "u64",       index: false },
        { name: "virtualTokenReserves", type: "u64",       index: false },
        { name: "realTokenReserves",    type: "u64",       index: false },
        { name: "timestamp",            type: "i64",       index: false },
      ],
    },
    {
      name: "GraduationEvent",
      fields: [
        { name: "mint",              type: "publicKey", index: false },
        { name: "creator",           type: "publicKey", index: false },
        { name: "realSolReserves",   type: "u64",       index: false },
        { name: "realTokenReserves", type: "u64",       index: false },
        { name: "totalVolumeSol",    type: "u64",       index: false },
        { name: "totalTrades",       type: "u64",       index: false },
        { name: "timestamp",         type: "i64",       index: false },
      ],
    },
  ],
  errors: [],
};

// Build the EventParser once
let eventParser: EventParser;
try {
  const coder = new BorshCoder(IDL);
  eventParser = new EventParser(PROGRAM_ID, coder);
} catch (e) {
  console.error("Failed to build EventParser:", e);
}

// ─── Event handlers ────────────────────────────────────────────────────────────

async function handleBuyEvent(
  signature: string,
  data: any,
  io: Server
): Promise<void> {
  const mint        = data.mint.toString();
  const buyer       = data.buyer.toString();
  const solAmount   = BigInt(data.solAmount.toString());
  const tokenAmount = BigInt(data.tokenAmount.toString());
  const virtualSol  = BigInt(data.virtualSolReserves.toString());
  const virtualTok  = BigInt(data.virtualTokenReserves.toString());
  const realSol     = BigInt(data.realSolReserves.toString());
  const realTok     = BigInt(data.realTokenReserves.toString());
  const fee         = BigInt(data.fee.toString());
  const isGraduated = data.isGraduated as boolean;
  const timestamp   = Number(data.timestamp.toString());

  const price = Number(virtualSol) / Number(virtualTok);
  const marketCapSol =
    (Number(virtualSol) * Number(BONDING_CURVE_CONSTANTS.TOTAL_SUPPLY)) /
    Number(virtualTok) / 1e9;

  try {
    await prisma.trade.upsert({
      where: { signature },
      create: {
        signature,
        mint,
        trader: buyer,
        type: "BUY",
        solAmount,
        tokenAmount,
        price,
        fee,
        timestamp: new Date(timestamp * 1000),
      },
      update: {},
    });

    // Recompute the rolling 24h volume from the trade table so the list
    // endpoint's sort=trending reflects real activity.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const vol24h = await prisma.trade.aggregate({
      where: { mint, timestamp: { gte: oneDayAgo } },
      _sum: { solAmount: true },
    });
    const volume24h = Number(vol24h._sum.solAmount ?? 0n) / 1e9;

    await prisma.token.update({
      where: { mint },
      data: {
        virtualSolReserves: virtualSol,
        virtualTokenReserves: virtualTok,
        realSolReserves: realSol,
        realTokenReserves: realTok,
        marketCapSol,
        volume24h,
        isGraduated,
        graduatedAt: isGraduated ? new Date() : undefined,
        trades: { increment: 1 },
      },
    });

    const token = await prisma.token.findUnique({
      where: { mint },
      select: { name: true, symbol: true, imageUrl: true, creator: true },
    });

    broadcastTrade(io, {
      type: "BUY",
      mint,
      trader: buyer,
      signature,
      solAmount: solAmount.toString(),
      tokenAmount: tokenAmount.toString(),
      price,
      virtualSolReserves: virtualSol.toString(),
      virtualTokenReserves: virtualTok.toString(),
      realSolReserves: realSol.toString(),
      timestamp,
      tokenName: token?.name,
      tokenSymbol: token?.symbol,
      tokenImageUrl: token?.imageUrl ?? undefined,
    });

    broadcastPriceUpdate(io, {
      mint,
      price,
      virtualSolReserves: virtualSol.toString(),
      virtualTokenReserves: virtualTok.toString(),
      realSolReserves: realSol.toString(),
      marketCapSol,
      graduationProgress: Math.min(100, (Number(realSol) / GRADUATION_THRESHOLD) * 100),
      timestamp,
    });

    if (isGraduated) {
      // Fetch final stats for the graduation broadcast; token was updated above.
      const graduated = await prisma.token.findUnique({
        where: { mint },
        select: { creator: true, volume24h: true, trades: true },
      });
      broadcastGraduation(io, {
        mint,
        creator: graduated?.creator ?? "",
        totalVolumeSol: (graduated?.volume24h ?? 0).toString(),
        totalTrades: (graduated?.trades ?? 0).toString(),
        timestamp,
      });

      // Trigger the on-chain `graduate` instruction (async, non-blocking).
      // This distributes SOL + transfers tokens to treasury, then emits GraduationEvent
      // which in turn triggers Raydium pool creation via handleGraduationEvent.
      callGraduateInstruction(mint).catch((err) =>
        console.error("[KEEPER] Unhandled error:", err)
      );
    }

    console.log(`[BUY] ${mint.slice(0, 8)}… buyer=${buyer.slice(0, 8)}… sol=${Number(solAmount) / 1e9}`);
  } catch (error) {
    console.error("Error handling buy event:", error);
  }
}

async function handleSellEvent(
  signature: string,
  data: any,
  io: Server
): Promise<void> {
  const mint        = data.mint.toString();
  const seller      = data.seller.toString();
  const tokenAmount = BigInt(data.tokenAmount.toString());
  const solAmount   = BigInt(data.solAmount.toString());
  const virtualSol  = BigInt(data.virtualSolReserves.toString());
  const virtualTok  = BigInt(data.virtualTokenReserves.toString());
  const realSol     = BigInt(data.realSolReserves.toString());
  const realTok     = BigInt(data.realTokenReserves.toString());
  const fee         = BigInt(data.fee.toString());
  const timestamp   = Number(data.timestamp.toString());

  const price = Number(virtualSol) / Number(virtualTok);
  const marketCapSol =
    (Number(virtualSol) * Number(BONDING_CURVE_CONSTANTS.TOTAL_SUPPLY)) /
    Number(virtualTok) / 1e9;

  try {
    await prisma.trade.upsert({
      where: { signature },
      create: {
        signature,
        mint,
        trader: seller,
        type: "SELL",
        solAmount,
        tokenAmount,
        price,
        fee,
        timestamp: new Date(timestamp * 1000),
      },
      update: {},
    });

    // Recompute rolling 24h volume (same pattern as handleBuyEvent).
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const vol24h = await prisma.trade.aggregate({
      where: { mint, timestamp: { gte: oneDayAgo } },
      _sum: { solAmount: true },
    });
    const volume24h = Number(vol24h._sum.solAmount ?? 0n) / 1e9;

    await prisma.token.update({
      where: { mint },
      data: {
        virtualSolReserves: virtualSol,
        virtualTokenReserves: virtualTok,
        realSolReserves: realSol,
        realTokenReserves: realTok,
        marketCapSol,
        volume24h,
        trades: { increment: 1 },
      },
    });

    const token = await prisma.token.findUnique({
      where: { mint },
      select: { name: true, symbol: true, imageUrl: true },
    });

    broadcastTrade(io, {
      type: "SELL",
      mint,
      trader: seller,
      signature,
      solAmount: solAmount.toString(),
      tokenAmount: tokenAmount.toString(),
      price,
      virtualSolReserves: virtualSol.toString(),
      virtualTokenReserves: virtualTok.toString(),
      realSolReserves: realSol.toString(),
      timestamp,
      tokenName: token?.name,
      tokenSymbol: token?.symbol,
      tokenImageUrl: token?.imageUrl ?? undefined,
    });

    broadcastPriceUpdate(io, {
      mint,
      price,
      virtualSolReserves: virtualSol.toString(),
      virtualTokenReserves: virtualTok.toString(),
      realSolReserves: realSol.toString(),
      marketCapSol,
      graduationProgress: Math.min(100, (Number(realSol) / GRADUATION_THRESHOLD) * 100),
      timestamp,
    });

    console.log(`[SELL] ${mint.slice(0, 8)}… seller=${seller.slice(0, 8)}… sol=${Number(solAmount) / 1e9}`);
  } catch (error) {
    console.error("Error handling sell event:", error);
  }
}

async function handleTokenCreatedEvent(
  data: any,
  io: Server
): Promise<void> {
  const mint             = data.mint.toString();
  const creator          = data.creator.toString();
  const name             = data.name as string;
  const symbol           = data.symbol as string;
  const timestamp        = Number(data.timestamp.toString());
  // Use the real_token_reserves value emitted by the program rather than a
  // hardcoded backend constant — guards against future Rust-side changes.
  const realTokenReserves = data.realTokenReserves
    ? BigInt(data.realTokenReserves.toString())
    : BONDING_CURVE_CONSTANTS.REAL_TOKEN_RESERVES_INIT;

  try {
    await prisma.token.upsert({
      where: { mint },
      create: {
        mint,
        name,
        symbol,
        creator,
        virtualSolReserves: BONDING_CURVE_CONSTANTS.INITIAL_VIRTUAL_SOL,
        virtualTokenReserves: BONDING_CURVE_CONSTANTS.INITIAL_VIRTUAL_TOKENS,
        realSolReserves: 0n,
        realTokenReserves,
        totalSupply: BONDING_CURVE_CONSTANTS.TOTAL_SUPPLY,
      },
      update: {},
    });

    broadcastTokenCreated(io, { mint, creator, name, symbol, timestamp });
    console.log(`[CREATE] ${symbol} (${mint.slice(0, 8)}…) by ${creator.slice(0, 8)}…`);
  } catch (error) {
    console.error("Error handling token created event:", error);
  }
}

async function handleGraduationEvent(
  data: any,
  io: Server
): Promise<void> {
  const mint            = data.mint.toString();
  const creator         = data.creator.toString();
  const timestamp       = Number(data.timestamp.toString());
  // real_sol_reserves in the event = 90% liquidity SOL (see graduate.rs)
  // real_token_reserves in the event = all unsold tokens transferred to treasury
  const liquiditySol    = BigInt(data.realSolReserves.toString());
  const liquidityTokens = BigInt(data.realTokenReserves.toString());

  try {
    // Mark graduated immediately so frontend reflects the state
    await prisma.token.update({
      where: { mint },
      data: { isGraduated: true, graduatedAt: new Date() },
    });

    broadcastGraduation(io, {
      mint,
      creator,
      totalVolumeSol: data.totalVolumeSol.toString(),
      totalTrades: data.totalTrades.toString(),
      timestamp,
    });
    console.log(`[GRADUATE] ${mint.slice(0, 8)}… SOL=${Number(liquiditySol)/1e9} tokens=${Number(liquidityTokens)/1e6}`);

    // Create Raydium CPMM pool asynchronously — non-blocking
    // Pool creation can take several seconds; we don't want to block the indexer
    createRaydiumPool(mint, liquiditySol, liquidityTokens)
      .then(async (poolId) => {
        if (poolId) {
          await prisma.token.update({
            where: { mint },
            data: { raydiumPoolId: poolId },
          });
          console.log(`[RAYDIUM] Stored pool ID for ${mint.slice(0, 8)}…: ${poolId}`);
          // Broadcast updated pool ID so open token pages can update their links
          io.to(`token:${mint}`).emit("pool_created", { mint, poolId });
        }
      })
      .catch((err) => console.error("[RAYDIUM] Async pool creation error:", err));

  } catch (error) {
    console.error("Error handling graduation event:", error);
  }
}

// ─── Log subscription ──────────────────────────────────────────────────────────

function setupLogSubscription(io: Server): void {
  if (subscriptionId !== null) {
    connection.removeOnLogsListener(subscriptionId);
  }

  subscriptionId = connection.onLogs(
    PROGRAM_ID,
    async (logs: Logs, _ctx: Context) => {
      const { signature, logs: logMessages, err } = logs;
      if (err) return;

      try {
        if (!eventParser) return;

        // Parse all Anchor events from this transaction's logs
        const events = [...eventParser.parseLogs(logMessages)];

        for (const event of events) {
          switch (event.name) {
            case "BuyEvent":
              await handleBuyEvent(signature, event.data, io);
              break;
            case "SellEvent":
              await handleSellEvent(signature, event.data, io);
              break;
            case "TokenCreatedEvent":
              await handleTokenCreatedEvent(event.data, io);
              break;
            case "GraduationEvent":
              await handleGraduationEvent(event.data, io);
              break;
          }
        }
      } catch (error) {
        console.error("Error processing logs:", error);
      }
    },
    "confirmed"
  );

  console.log(`Indexer watching program ${config.solana.programId} (sub #${subscriptionId})`);
}

async function connect(io: Server): Promise<void> {
  connection = new Connection(config.solana.rpcUrl, {
    wsEndpoint: config.solana.wsUrl,
    commitment: "confirmed",
  });

  setupLogSubscription(io);

  console.log(`Indexer connected to ${config.solana.rpcUrl}`);
}

export async function startIndexer(io: Server): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  console.log("Starting blockchain indexer...");

  try {
    await connect(io);
  } catch (error) {
    console.error("Failed to start indexer:", error);
    scheduleReconnect(io);
  }
}

function scheduleReconnect(io: Server): void {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);

  console.log("Scheduling indexer reconnect in 10 seconds...");
  reconnectTimeout = setTimeout(async () => {
    try {
      await connect(io);
    } catch (error) {
      console.error("Reconnect failed:", error);
      scheduleReconnect(io);
    }
  }, 10_000);
}
