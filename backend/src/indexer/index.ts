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
import { holdersCache } from "../holdersCache";
import { getSolanaConnection } from "../solana/connection";
import { getMinuteBucketStart } from "../utils/timeBucket";

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
        { name: "tokensBurned",      type: "u64",       index: false },
        { name: "totalVolumeSol",    type: "u64",       index: false },
        { name: "totalTrades",       type: "u64",       index: false },
        { name: "timestamp",         type: "i64",       index: false },
      ],
    },
  ],
  errors: [],
};

// ─── In-memory token metadata cache ──────────────────────────────────────────
// Token name/symbol/imageUrl never change after creation — cache them so we
// don't query the DB on every trade just to populate broadcastTrade's fields.
const tokenMetaCache = new Map<string, { name: string; symbol: string; imageUrl?: string }>();

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
    // Guard against duplicate processing (WebSocket onLogs + polling can both
    // deliver the same confirmed tx). Return early if already indexed.
    const alreadyIndexed = await prisma.trade.findUnique({
      where: { signature },
      select: { id: true },
    });
    if (alreadyIndexed) return;

    // 🚀 Emit price_update IMMEDIATELY — all values come from the on-chain
    // event, no DB round-trip needed. This is what drives the live candle and
    // bonding-curve bar, so firing it here cuts latency from ~35ms to ~5ms.
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

    // Trade insert — critical write. Must complete before anything else.
    const tradeTs = new Date(timestamp * 1000);
    const bucketStart = getMinuteBucketStart(tradeTs);
    await prisma.trade.create({
      data: {
        signature,
        mint,
        trader: buyer,
        type: "BUY",
        solAmount,
        tokenAmount,
        price,
        fee,
        timestamp: tradeTs,
      },
    });

    // Bucket upsert — stats optimization. Isolated so any failure here never
    // silences broadcastTrade. volume24h stays null → Token.volume24h not overwritten.
    let volume24h: number | null = null;
    try {
      await (prisma as any).tradeVolumeBucket.upsert({
        where: { mint_bucketStart: { mint, bucketStart } },
        update: { volumeLamports: { increment: solAmount }, trades: { increment: 1 } },
        create: { mint, bucketStart, volumeLamports: solAmount, trades: 1 },
      });
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const bucketSum = await (prisma as any).tradeVolumeBucket.aggregate({
        where: { mint, bucketStart: { gte: oneDayAgo } },
        _sum: { volumeLamports: true },
      });
      volume24h = Number(bucketSum._sum.volumeLamports ?? 0n) / 1e9;
    } catch (bucketErr) {
      console.error(`[BUCKET] BUY upsert failed for ${mint.slice(0, 8)}… — volume24h not updated:`, bucketErr);
    }

    // Holder upsert then count (count must follow upsert).
    await (prisma as any).holder.upsert({
      where: { mint_wallet: { mint, wallet: buyer } },
      update: { balance: { increment: tokenAmount } },
      create: { mint, wallet: buyer, balance: tokenAmount },
    });

    // Token metadata (name/symbol/image) never changes — use memory cache to
    // avoid a DB query on every trade.
    const cachedMeta = tokenMetaCache.get(mint);
    const [holdersCount, tokenMeta] = await Promise.all([
      (prisma as any).holder.count({ where: { mint, balance: { gt: 0n } } }),
      cachedMeta
        ? Promise.resolve(cachedMeta)
        : prisma.token.findUnique({
            where: { mint },
            select: { name: true, symbol: true, imageUrl: true, creator: true },
          }),
    ]);
    if (tokenMeta && !cachedMeta) tokenMetaCache.set(mint, tokenMeta as any);

    const updatedToken = await prisma.token.update({
      where: { mint },
      data: {
        virtualSolReserves: virtualSol,
        virtualTokenReserves: virtualTok,
        realSolReserves: realSol,
        realTokenReserves: realTok,
        marketCapSol,
        ...(volume24h !== null ? { volume24h } : {}),
        isGraduated,
        graduatedAt: isGraduated ? new Date() : undefined,
        trades: { increment: 1 },
        holders: holdersCount,
      },
      select: { trades: true },
    });

    holdersCache.delete(mint);

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
      tokenName: (tokenMeta as any)?.name,
      tokenSymbol: (tokenMeta as any)?.symbol,
      tokenImageUrl: (tokenMeta as any)?.imageUrl ?? undefined,
      volume24h: volume24h ?? undefined,
      trades: updatedToken.trades,
      holders: holdersCount,
    });

    if (isGraduated) {
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
    // Duplicate guard — same as handleBuyEvent.
    const alreadyIndexed = await prisma.trade.findUnique({
      where: { signature },
      select: { id: true },
    });
    if (alreadyIndexed) return;

    // 🚀 Emit price_update IMMEDIATELY from on-chain data.
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

    // Trade insert — critical write. Must complete before anything else.
    const tradeTs = new Date(timestamp * 1000);
    const bucketStart = getMinuteBucketStart(tradeTs);
    await prisma.trade.create({
      data: {
        signature,
        mint,
        trader: seller,
        type: "SELL",
        solAmount,
        tokenAmount,
        price,
        fee,
        timestamp: tradeTs,
      },
    });

    // Bucket upsert — isolated so failures never silence broadcastTrade.
    let volume24h: number | null = null;
    try {
      await (prisma as any).tradeVolumeBucket.upsert({
        where: { mint_bucketStart: { mint, bucketStart } },
        update: { volumeLamports: { increment: solAmount }, trades: { increment: 1 } },
        create: { mint, bucketStart, volumeLamports: solAmount, trades: 1 },
      });
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const bucketSum = await (prisma as any).tradeVolumeBucket.aggregate({
        where: { mint, bucketStart: { gte: oneDayAgo } },
        _sum: { volumeLamports: true },
      });
      volume24h = Number(bucketSum._sum.volumeLamports ?? 0n) / 1e9;
    } catch (bucketErr) {
      console.error(`[BUCKET] SELL upsert failed for ${mint.slice(0, 8)}… — volume24h not updated:`, bucketErr);
    }

    // Decrement seller's balance then clean up zero rows.
    await (prisma as any).holder.upsert({
      where: { mint_wallet: { mint, wallet: seller } },
      update: { balance: { decrement: tokenAmount } },
      create: { mint, wallet: seller, balance: 0n },
    });
    await (prisma as any).holder.deleteMany({
      where: { mint, wallet: seller, balance: { lte: 0n } },
    });

    const cachedMeta = tokenMetaCache.get(mint);
    const [holdersCount, tokenMeta] = await Promise.all([
      (prisma as any).holder.count({ where: { mint, balance: { gt: 0n } } }),
      cachedMeta
        ? Promise.resolve(cachedMeta)
        : prisma.token.findUnique({
            where: { mint },
            select: { name: true, symbol: true, imageUrl: true },
          }),
    ]);
    if (tokenMeta && !cachedMeta) tokenMetaCache.set(mint, tokenMeta as any);

    const updatedToken = await prisma.token.update({
      where: { mint },
      data: {
        virtualSolReserves: virtualSol,
        virtualTokenReserves: virtualTok,
        realSolReserves: realSol,
        realTokenReserves: realTok,
        marketCapSol,
        ...(volume24h !== null ? { volume24h } : {}),
        trades: { increment: 1 },
        holders: holdersCount,
      },
      select: { trades: true },
    });

    holdersCache.delete(mint);

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
      tokenName: (tokenMeta as any)?.name,
      tokenSymbol: (tokenMeta as any)?.symbol,
      tokenImageUrl: (tokenMeta as any)?.imageUrl ?? undefined,
      volume24h: volume24h ?? undefined,
      trades: updatedToken.trades,
      holders: holdersCount,
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
  // realTokenReserves = 300M reserve tokens going to Raydium pool
  // tokensBurned = unsold curve tokens that were destroyed
  const liquidityTokens = BigInt(data.realTokenReserves.toString());
  const tokensBurned    = BigInt(data.tokensBurned?.toString() ?? "0");

  try {
    // Mark graduated immediately so frontend reflects the state
    const tokenRecord = await prisma.token.update({
      where: { mint },
      data: { isGraduated: true, graduatedAt: new Date() },
      select: { raydiumPoolId: true },
    });

    broadcastGraduation(io, {
      mint,
      creator,
      totalVolumeSol: data.totalVolumeSol.toString(),
      totalTrades: data.totalTrades.toString(),
      timestamp,
    });
    console.log(`[GRADUATE] ${mint.slice(0, 8)}… SOL=${Number(liquiditySol)/1e9} poolTokens=${Number(liquidityTokens)/1e6} burned=${Number(tokensBurned)/1e6}`);

    // Skip pool creation if poolId is already stored (idempotency for polling re-runs)
    if (tokenRecord.raydiumPoolId) {
      console.log(`[RAYDIUM] Pool already stored for ${mint.slice(0, 8)}…: ${tokenRecord.raydiumPoolId}`);
      return;
    }

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

// ─── Polling-based fallback indexer ───────────────────────────────────────────
// The public devnet WebSocket drops events silently. This polling loop fetches
// recent program transactions every 10s and processes any that were missed.

let lastProcessedSignature: string | null = null;
let pollTimeout: ReturnType<typeof setTimeout> | null = null;

// Adaptive polling: back off when idle to reduce RPC load.
const POLL_MIN_MS = 5_000;
const POLL_MAX_MS = 30_000;
let pollDelayMs = POLL_MIN_MS;

// Concurrency cap for processing transactions fetched by polling.
// Keeps a single slow `getTransaction` from stalling the whole tick, without
// stampeding the RPC provider.
const POLL_PROCESS_CONCURRENCY = 3;

async function processTransaction(
  signature: string,
  io: Server
): Promise<void> {
  try {
    // Skip if already processed (check DB for either buy or sell trade)
    const existing = await prisma.trade.findUnique({ where: { signature } });
    if (existing) return;

    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx || tx.meta?.err) return;

    const logs = tx.meta?.logMessages ?? [];
    if (!eventParser) return;

    const events = [...eventParser.parseLogs(logs)];
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
  } catch (err: any) {
    // Non-fatal — skip this tx and continue
    if (!err?.message?.includes("not found")) {
      console.error(`[POLL] Error processing ${signature.slice(0,8)}…:`, err?.message ?? err);
    }
  }
}

async function pollRecentTransactions(io: Server): Promise<number> {
  try {
    const opts: any = { limit: 30, commitment: "confirmed" };
    if (lastProcessedSignature) opts.until = lastProcessedSignature;

    const sigs = await connection.getSignaturesForAddress(PROGRAM_ID, opts);
    if (!sigs.length) return 0;

    // Process from oldest to newest (reverse order)
    const toProcess = sigs.filter((s) => !s.err).reverse();
    for (let i = 0; i < toProcess.length; i += POLL_PROCESS_CONCURRENCY) {
      const batch = toProcess.slice(i, i + POLL_PROCESS_CONCURRENCY);
      await Promise.allSettled(batch.map((s) => processTransaction(s.signature, io)));
    }

    // Remember the newest signature so next poll only fetches newer txs
    lastProcessedSignature = sigs[0].signature;
    return sigs.length;
  } catch (err: any) {
    console.error("[POLL] Failed to fetch signatures:", err?.message ?? err);
    return 0;
  }
}

function scheduleNextPoll(io: Server): void {
  if (pollTimeout) clearTimeout(pollTimeout);
  pollTimeout = setTimeout(async () => {
    const fetched = await pollRecentTransactions(io);
    // Backoff: if nothing new, increase delay; if activity, reset to min.
    pollDelayMs = fetched === 0
      ? Math.min(POLL_MAX_MS, Math.floor(pollDelayMs * 1.5))
      : POLL_MIN_MS;
    scheduleNextPoll(io);
  }, pollDelayMs);
}

async function connect(io: Server): Promise<void> {
  connection = getSolanaConnection();

  setupLogSubscription(io);

  // Start polling fallback — adaptive backoff to reduce RPC load when idle
  if (pollTimeout) clearTimeout(pollTimeout);
  pollDelayMs = POLL_MIN_MS;
  // Initial poll to backfill recent history
  await pollRecentTransactions(io);
  scheduleNextPoll(io);
  console.log(`[POLL] Transaction polling started (${POLL_MIN_MS}–${POLL_MAX_MS}ms adaptive)`);

  console.log(`Indexer connected to ${config.solana.rpcUrl}`);
}

// ─── One-time Holder table backfill ───────────────────────────────────────────
// Populates the Holder table from trade history for any mint that has trades
// but no holder records yet (i.e. tokens that existed before this migration).
// Runs once on startup; subsequent trades are maintained incrementally above.

async function seedHolders(): Promise<void> {
  try {
    const mintsWithTrades  = await prisma.trade.groupBy({ by: ["mint"] });
    const mintsWithHolders = await (prisma as any).holder.groupBy({ by: ["mint"] });
    const seeded = new Set((mintsWithHolders as any[]).map((h: any) => h.mint));
    const unseeded = mintsWithTrades.filter((t) => !seeded.has(t.mint));

    if (unseeded.length === 0) return;

    console.log(`[SEED] Backfilling Holder table for ${unseeded.length} mint(s)…`);

    for (const { mint } of unseeded) {
      const rows = await prisma.$queryRaw<{ wallet: string; balance: bigint }[]>`
        SELECT trader AS wallet,
               SUM(CASE WHEN type = 'BUY' THEN "tokenAmount" ELSE -"tokenAmount" END) AS balance
        FROM   "Trade"
        WHERE  mint = ${mint}
        GROUP  BY trader
        HAVING SUM(CASE WHEN type = 'BUY' THEN "tokenAmount" ELSE -"tokenAmount" END) > 0
      `;

      for (const row of rows) {
        // $queryRaw returns PostgreSQL bigint as Prisma Decimal — must convert
        // to JS BigInt explicitly before passing to the Holder upsert.
        const balance = BigInt(row.balance.toString());
        await (prisma as any).holder.upsert({
          where:  { mint_wallet: { mint, wallet: row.wallet } },
          update: { balance },
          create: { mint, wallet: row.wallet, balance },
        });
      }

      if (rows.length > 0) {
        console.log(`[SEED] ${mint.slice(0, 8)}… — ${rows.length} holder(s) seeded`);
      }
    }
  } catch (err) {
    // Non-fatal — the endpoint falls back to legacy SQL if table is empty.
    console.error("[SEED] Holder seeding error:", err);
  }
}

export async function startIndexer(io: Server): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  console.log("Starting blockchain indexer...");

  // Backfill Holder table for pre-existing tokens (non-blocking).
  seedHolders().catch(console.error);

  // Decay stale volume24h every 10 minutes.
  // Tokens stop receiving indexer updates after trading stops, so Token.volume24h
  // never resets on its own. This job recomputes it from the bucket table for any
  // token whose last trade was in the 24-48h window (i.e. sliding out of the window).
  setInterval(async () => {
    try {
      const oneDayAgo  = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      // Find tokens that haven't traded in 2+ h but still have non-zero volume24h.
      // Using a 2h buffer means we start decaying well before the 24h window closes.
      const stale = await prisma.token.findMany({
        where: { updatedAt: { lt: twoHoursAgo }, volume24h: { gt: 0 }, isGraduated: false },
        select: { mint: true },
      });
      for (const { mint } of stale) {
        const sum = await (prisma as any).tradeVolumeBucket.aggregate({
          where: { mint, bucketStart: { gte: oneDayAgo } },
          _sum: { volumeLamports: true },
        });
        await prisma.token.update({
          where: { mint },
          data: { volume24h: Number(sum._sum.volumeLamports ?? 0n) / 1e9 },
        });
      }
      if (stale.length > 0) {
        console.log(`[DECAY] Recomputed volume24h for ${stale.length} idle token(s)`);
      }
    } catch (err) {
      console.error("[DECAY] volume24h decay error:", err);
    }
  }, 10 * 60 * 1000);

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

export function stopIndexer(): void {
  isRunning = false;
  if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
  if (pollTimeout) { clearTimeout(pollTimeout); pollTimeout = null; }
  if (subscriptionId !== null && connection) {
    connection.removeOnLogsListener(subscriptionId);
    subscriptionId = null;
  }
  console.log("[INDEXER] Stopped.");
}
