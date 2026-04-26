import { Router, Request, Response } from "express";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "../index";
import { BONDING_CURVE_CONSTANTS, config } from "../config";
import { getSolanaConnection } from "../solana/connection";

export const tokensRouter = Router();

const PAGE_SIZE = 20;

// Validation schemas
const createTokenSchema = z.object({
  mint: z.string().min(32).max(44),
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  twitterUrl: z.string().url().optional(),
  telegramUrl: z.string().url().optional(),
  creator: z.string().min(32).max(44),
});

function computeMarketCap(
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
  totalSupply: bigint
): number {
  if (virtualTokenReserves === 0n) return 0;
  // price = virtualSol / virtualToken (in lamports per token unit)
  // marketCap = price * totalSupply / 1e6 (convert to SOL)
  const marketCapLamports =
    (virtualSolReserves * totalSupply) / virtualTokenReserves;
  return Number(marketCapLamports) / 1e9; // Convert to SOL
}

function computePrice(
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint
): number {
  if (virtualTokenReserves === 0n) return 0;
  return Number(virtualSolReserves) / Number(virtualTokenReserves);
}

// ─── Shared token enrichment ─────────────────────────────────────────────────
// Fetches per-mint aggregates (holder count, trades in last 15 min, last trade
// timestamp) and formats bigint fields to strings. Used by both the list
// endpoint and the ?mints= batch endpoint so the shape is always identical.

async function enrichTokens(tokens: any[]): Promise<any[]> {
  if (tokens.length === 0) return [];
  const mints = tokens.map((t: any) => t.mint);
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

  const [holderRows, recentTradeRows, lastTradeRows] = await Promise.all([
    // Holder count: indexed Holder table grouped by mint — O(log n) per mint,
    // much faster than trade.groupBy which scans all trades for every mint.
    (prisma as any).holder.groupBy({
      by: ["mint"],
      where: { mint: { in: mints }, balance: { gt: 0n } },
      _count: { _all: true },
    }),
    prisma.trade.groupBy({
      by: ["mint"],
      where: { mint: { in: mints }, timestamp: { gte: fifteenMinAgo } },
      _count: { mint: true },
    }),
    prisma.trade.findMany({
      where: { mint: { in: mints } },
      orderBy: { timestamp: "desc" },
      distinct: ["mint"],
      select: { mint: true, timestamp: true },
    }),
  ]);

  const holderCountByMint: Record<string, number> = {};
  for (const row of holderRows) {
    holderCountByMint[row.mint] = (row as any)._count._all;
  }
  const trades15mByMint: Record<string, number> = {};
  for (const row of recentTradeRows) {
    trades15mByMint[row.mint] = (row as any)._count.mint;
  }
  const lastTradeByMint: Record<string, Date> = {};
  for (const row of lastTradeRows) {
    lastTradeByMint[row.mint] = row.timestamp;
  }

  return tokens.map((token: any) => {
    const { id: _id, _count, ...rest } = token;
    return {
      ...rest,
      virtualSolReserves: token.virtualSolReserves.toString(),
      virtualTokenReserves: token.virtualTokenReserves.toString(),
      realSolReserves: token.realSolReserves.toString(),
      realTokenReserves: token.realTokenReserves.toString(),
      totalSupply: token.totalSupply.toString(),
      trades: _count.tradeHistory,
      holders: holderCountByMint[token.mint] ?? 0,
      trades15m: trades15mByMint[token.mint] ?? 0,
      lastTradeAt: lastTradeByMint[token.mint] ?? null,
      currentPrice: computePrice(token.virtualSolReserves, token.virtualTokenReserves),
      graduationProgress:
        (Number(token.realSolReserves) /
          Number(BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD)) *
        100,
    };
  });
}

// GET /api/tokens - list tokens with sorting, OR batch lookup by ?mints=a,b,c
tokensRouter.get("/", async (req: Request, res: Response) => {
  try {
    // ── Batch lookup by explicit mint addresses ────────────────────────────
    // Used by the watchlist tab so that watched tokens are always returned
    // regardless of recency — the old approach (filter client-side from the
    // newest-50 list) silently dropped any watchlisted token older than #50.
    //
    // Guard: check !== undefined rather than truthiness so that ?mints= (empty
    // value, which trims to "") does not fall through to the list path.
    if (req.query.mints !== undefined) {
      const mintsParam = (req.query.mints as string).trim();

      // ?mints= or ?mints=   → return empty cleanly.
      if (!mintsParam) {
        return res.json({ tokens: [], pagination: { page: 1, limit: 0, total: 0, pages: 1 } });
      }

      // Validate each segment: base58 public keys are 32–44 chars, alphanumeric.
      const mintList = mintsParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length >= 32 && s.length <= 44)
        .slice(0, 100); // cap to prevent accidental large queries

      // ?mints=,,, or all segments too short/long → return empty cleanly.
      if (mintList.length === 0) {
        return res.json({ tokens: [], pagination: { page: 1, limit: 0, total: 0, pages: 1 } });
      }

      const rows = await prisma.token.findMany({
        where: { mint: { in: mintList } },
        include: { _count: { select: { tradeHistory: true } } },
      });

      const enriched = await enrichTokens(rows);

      // Restore the caller's mint order — Prisma findMany({ in: [...] }) does not
      // preserve input order. Mints absent from the DB are silently dropped.
      const byMint = new Map(enriched.map((t) => [t.mint, t]));
      const formattedTokens = mintList.map((m) => byMint.get(m)).filter(Boolean);

      return res.json({
        tokens: formattedTokens,
        pagination: { page: 1, limit: mintList.length, total: formattedTokens.length, pages: 1 },
      });
    }

    // ── Regular paginated list ─────────────────────────────────────────────
    const sort = (req.query.sort as string) || "new";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || PAGE_SIZE));
    const skip = (page - 1) * limit;
    const creator = req.query.creator as string | undefined;
    const q = (req.query.q as string | undefined)?.trim();

    let orderBy: any;
    let where: any = {};

    if (creator) where.creator = creator;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { symbol: { contains: q, mode: "insensitive" } },
      ];
    }

    switch (sort) {
      case "trending":
        // Non-graduated (isGraduated=false) sorts before graduated (true asc),
        // then most trades first, then volume as tiebreaker
        orderBy = [{ isGraduated: "asc" }, { trades: "desc" }, { volume24h: "desc" }];
        break;
      case "marketcap":
        orderBy = { marketCapSol: "desc" };
        break;
      case "graduating":
        where = {
          ...where,
          isGraduated: false,
          realSolReserves: { gte: BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD * 70n / 100n },
        };
        orderBy = { realSolReserves: "desc" };
        break;
      case "graduated":
        where = { ...where, isGraduated: true };
        orderBy = { graduatedAt: "desc" };
        break;
      case "new":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { _count: { select: { tradeHistory: true } } },
      }),
      prisma.token.count({ where }),
    ]);

    const formattedTokens = await enrichTokens(tokens);

    res.json({
      tokens: formattedTokens,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /tokens error:", error);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

// GET /api/tokens/:mint - single token
tokensRouter.get("/:mint", async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;

    const token = await prisma.token.findUnique({
      where: { mint },
      include: {
        _count: {
          select: { tradeHistory: true },
        },
      },
    });

    if (!token) {
      return res.status(404).json({ error: "Token not found" });
    }

    // ── Live chain sync ─────────────────────────────────────────────────────
    // The public devnet WebSocket drops events. Always read bonding curve state
    // from chain when the token is active (not graduated) or DB looks stale.
    // Rate-limited: re-read only if DB hasn't been updated in the last 15s.
    let liveVirtualSol     = token.virtualSolReserves;
    let liveVirtualTokens  = token.virtualTokenReserves;
    let liveRealSol        = token.realSolReserves;
    let liveRealTokens     = token.realTokenReserves;
    let liveIsGraduated    = token.isGraduated;
    let liveTotalTrades    = BigInt(0);
    let liveTotalVolumeSol = BigInt(0);

    const staleSecs = (Date.now() - token.updatedAt.getTime()) / 1000;
    const needsChainRead = !token.isGraduated || staleSecs > 15;

    if (needsChainRead) {
      try {
        const conn = getSolanaConnection();
        const programId = new PublicKey(config.solana.programId);
        const mintPk = new PublicKey(mint);
        const [bcPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("bonding_curve"), mintPk.toBuffer()],
          programId
        );
        const info = await conn.getAccountInfo(bcPDA);
        if (info?.data && info.data.length >= 130) {
          const data = info.data;
          const readU64 = (offset: number): bigint =>
            data.readBigUInt64LE(offset);
          liveVirtualSol    = readU64(72);
          liveVirtualTokens = readU64(80);
          liveRealSol       = readU64(88);
          liveRealTokens    = readU64(96);
          liveIsGraduated   = data[112] === 1;
          liveTotalVolumeSol = readU64(121);
          liveTotalTrades    = readU64(129);

          // Persist so DB reflects chain state
          await prisma.token.update({
            where: { mint },
            data: {
              virtualSolReserves:  liveVirtualSol,
              virtualTokenReserves: liveVirtualTokens,
              realSolReserves:     liveRealSol,
              realTokenReserves:   liveRealTokens,
              isGraduated:         liveIsGraduated,
              graduatedAt:         liveIsGraduated && !token.isGraduated ? new Date() : token.graduatedAt,
              marketCapSol: computeMarketCap(liveVirtualSol, liveVirtualTokens, token.totalSupply),
            },
          });

          // If token just graduated, trigger the graduate instruction
          if (liveIsGraduated && !token.isGraduated) {
            const { callGraduateInstruction } = await import("../services/graduateKeeper");
            callGraduateInstruction(mint).catch((e: any) =>
              console.error("[KEEPER] Auto-trigger from API:", e?.message)
            );
          }
        }
      } catch (chainErr) {
        console.warn(`[tokens] Chain read failed for ${mint.slice(0,8)}…:`, chainErr);
      }
    }

    // Holder count via indexed Holder table (O(log n), < 5 ms).
    // volume24h is kept up to date by the indexer via TradeVolumeBucket — no
    // per-request Trade scan needed.
    const holdersCount = await (prisma as any).holder.count({
      where: { mint, balance: { gt: 0n } },
    });

    const marketCapSol = computeMarketCap(
      liveVirtualSol,
      liveVirtualTokens,
      token.totalSupply
    );

    const { id: _id, _count, ...tokenRest } = token as any;
    const formatted = {
      ...tokenRest,
      virtualSolReserves: liveVirtualSol.toString(),
      virtualTokenReserves: liveVirtualTokens.toString(),
      realSolReserves: liveRealSol.toString(),
      realTokenReserves: liveRealTokens.toString(),
      totalSupply: token.totalSupply.toString(),
      marketCapSol,
      volume24h: token.volume24h,
      holders: holdersCount,
      trades: _count.tradeHistory || Number(liveTotalTrades),
      totalTrades: _count.tradeHistory || Number(liveTotalTrades),
      isGraduated: liveIsGraduated,
      graduationProgress: Math.min(100,
        (Number(liveRealSol) / Number(BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD)) * 100
      ),
      currentPrice: computePrice(liveVirtualSol, liveVirtualTokens),
    };

    res.json(formatted);
  } catch (error) {
    console.error("GET /tokens/:mint error:", error);
    res.status(500).json({ error: "Failed to fetch token" });
  }
});

// POST /api/tokens - create token record (called after on-chain creation)
// Verifies the creator matches the on-chain bonding curve PDA to prevent spoofing
tokensRouter.post("/", async (req: Request, res: Response) => {
  try {
    const data = createTokenSchema.parse(req.body);

    // Verify creator matches on-chain bonding curve state
    try {
      const mintPk = new PublicKey(data.mint);
      const programId = new PublicKey(config.solana.programId);
      const connection = getSolanaConnection();
      const [bcPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding_curve"), mintPk.toBuffer()],
        programId
      );
      const info = await connection.getAccountInfo(bcPDA);
      if (!info) {
        return res.status(400).json({ error: "Token not found on-chain" });
      }
      // Creator pubkey is stored at offset 8 (discriminator) + 32 (mint) = 40
      const onChainCreator = new PublicKey(info.data.slice(40, 72)).toBase58();
      if (onChainCreator !== data.creator) {
        return res.status(403).json({ error: "Creator mismatch — not the token creator" });
      }
    } catch (chainErr: any) {
      console.error("[TOKENS] On-chain creator verification failed:", chainErr?.message);
      return res.status(400).json({ error: "Failed to verify token on-chain" });
    }

    const tokenData = {
      name: data.name,
      symbol: data.symbol,
      description: data.description,
      imageUrl: data.imageUrl,
      websiteUrl: data.websiteUrl,
      twitterUrl: data.twitterUrl,
      telegramUrl: data.telegramUrl,
      creator: data.creator,
      virtualSolReserves: BONDING_CURVE_CONSTANTS.INITIAL_VIRTUAL_SOL,
      virtualTokenReserves: BONDING_CURVE_CONSTANTS.INITIAL_VIRTUAL_TOKENS,
      realSolReserves: 0n,
      realTokenReserves: BONDING_CURVE_CONSTANTS.REAL_TOKEN_RESERVES_INIT,
      totalSupply: BONDING_CURVE_CONSTANTS.TOTAL_SUPPLY,
    };

    const token = await prisma.token.upsert({
      where: { mint: data.mint },
      create: { mint: data.mint, ...tokenData },
      update: {
        name: data.name,
        symbol: data.symbol,
        description: data.description ?? undefined,
        imageUrl: data.imageUrl ?? undefined,
        websiteUrl: data.websiteUrl ?? undefined,
        twitterUrl: data.twitterUrl ?? undefined,
        telegramUrl: data.telegramUrl ?? undefined,
      },
    });

    res.status(201).json({
      ...token,
      virtualSolReserves: token.virtualSolReserves.toString(),
      virtualTokenReserves: token.virtualTokenReserves.toString(),
      realSolReserves: token.realSolReserves.toString(),
      realTokenReserves: token.realTokenReserves.toString(),
      totalSupply: token.totalSupply.toString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("POST /tokens error:", error);
    res.status(500).json({ error: "Failed to create token" });
  }
});

// Shared cache — defined in holdersCache.ts so the indexer can invalidate it
// immediately after each trade without creating a circular import.
import { holdersCache, HOLDERS_TTL } from "../holdersCache";

// Compute holders from trade history in DB (fallback when RPC is unavailable)
async function getHoldersFromDB(mint: string, totalSupplyUi: number) {
  const rows = await prisma.$queryRaw<{ wallet: string; balance: bigint }[]>`
    SELECT trader AS wallet,
           SUM(CASE WHEN type = 'BUY' THEN "tokenAmount" ELSE -"tokenAmount" END) AS balance
    FROM "Trade"
    WHERE mint = ${mint}
    GROUP BY trader
    HAVING SUM(CASE WHEN type = 'BUY' THEN "tokenAmount" ELSE -"tokenAmount" END) > 0
    ORDER BY balance DESC
    LIMIT 20
  `;
  return rows.map((r) => {
    const amount = Number(r.balance) / 1e6;
    const pct = totalSupplyUi > 0 ? (amount / totalSupplyUi) * 100 : 0;
    return { wallet: r.wallet, amount, pct };
  });
}

// GET /api/tokens/:mint/holders
// Fast path: Holder table (indexed DB read, maintained per-trade by indexer, ~5ms).
// Fallback: RPC → legacy SQL scan (pre-migration tokens / edge cases).
tokensRouter.get("/:mint/holders", async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;

    // Burst-absorb cache — indexer deletes this entry after every trade so the
    // first post-trade request always misses and gets fresh data.
    const cached = holdersCache.get(mint);
    if (cached && Date.now() - cached.ts < HOLDERS_TTL) {
      return res.json(cached.data);
    }

    const tokenRecord = await prisma.token.findUnique({
      where: { mint },
      select: { totalSupply: true },
    });
    const totalSupplyUi = tokenRecord
      ? Number(tokenRecord.totalSupply) / 1e6
      : Number(BONDING_CURVE_CONSTANTS.TOTAL_SUPPLY) / 1e6;

    // ── Primary: indexed Holder table (O(log n), < 10 ms) ──────────────────────
    const holderRows = await (prisma as any).holder.findMany({
      where: { mint, balance: { gt: 0n } },
      orderBy: { balance: "desc" },
      take: 20,
    });

    if (holderRows.length > 0) {
      const result = {
        holders: holderRows.map((h: any) => {
          const amount = Number(h.balance) / 1e6;
          const pct = totalSupplyUi > 0 ? (amount / totalSupplyUi) * 100 : 0;
          return { wallet: h.wallet, amount, pct };
        }),
        source: "db-indexed",
      };
      holdersCache.set(mint, { data: result, ts: Date.now() });
      return res.json(result);
    }

    // ── Fallback A: RPC (accurate for tokens that pre-date the Holder table) ──
    try {
      const mintPubkey = new PublicKey(mint);
      const connection = getSolanaConnection();
      const largest = await connection.getTokenLargestAccounts(mintPubkey);
      const accounts = largest.value.slice(0, 20);

      if (accounts.length > 0) {
        const accountInfos = await connection.getMultipleParsedAccounts(
          accounts.map((a) => a.address)
        );
        const holdersWithOwners = accounts.map((acct, i) => {
          const info = accountInfos.value[i];
          const parsed = (info?.data as any)?.parsed;
          const owner: string = parsed?.info?.owner ?? acct.address.toBase58();
          const amount = Number(acct.uiAmount ?? 0);
          const pct = totalSupplyUi > 0 ? (amount / totalSupplyUi) * 100 : 0;
          return { wallet: owner, amount, pct };
        });
        const result = { holders: holdersWithOwners, source: "rpc" };
        holdersCache.set(mint, { data: result, ts: Date.now() });
        return res.json(result);
      }
    } catch (rpcErr) {
      console.warn(`RPC holders failed for ${mint}, falling back to SQL:`, (rpcErr as Error).message);
    }

    // ── Fallback B: legacy trade-history SQL scan ──────────────────────────────
    const holders = await getHoldersFromDB(mint, totalSupplyUi);
    const result = { holders, source: "db-legacy" };
    holdersCache.set(mint, { data: result, ts: Date.now() });
    res.json(result);
  } catch (error) {
    console.error("GET /tokens/:mint/holders error:", error);
    res.status(500).json({ error: "Failed to fetch holders" });
  }
});

// GET /api/tokens/:mint/ohlcv - candlestick data
tokensRouter.get("/:mint/ohlcv", async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    const interval = (req.query.interval as string) || "5m";
    const limit = Math.min(500, parseInt(req.query.limit as string) || 200);

    // Map interval to milliseconds
    const intervalMap: Record<string, number> = {
      "1s":  1000,
      "1m":  60 * 1000,
      "5m":  5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "30m": 30 * 60 * 1000,
      "1h":  60 * 60 * 1000,
      "1d":  24 * 60 * 60 * 1000,
    };
    const intervalMs = intervalMap[interval] || intervalMap["5m"];

    // Fetch the most recent trades — no time-window filter so tokens that haven't
    // traded recently (or ever traded) still get chart data from their history.
    // `limit * 10` caps raw rows so JS aggregation stays bounded regardless of
    // trade count. The final `.slice(-limit)` trims to the requested candle count.
    const trades = await prisma.trade.findMany({
      where: { mint },
      orderBy: { timestamp: "desc" },
      take: limit * 10,
    });

    if (trades.length === 0) {
      return res.json([]);
    }

    // Aggregate in chronological order.
    trades.reverse();

    // Aggregate into OHLCV candles
    const candles = new Map<number, {
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>();

    // Seed prevClose with the bonding-curve launch price so the very first
    // candle has a non-zero body (open = launch price, close = post-trade price).
    const LAUNCH_PRICE =
      Number(BONDING_CURVE_CONSTANTS.INITIAL_VIRTUAL_SOL) /
      Number(BONDING_CURVE_CONSTANTS.INITIAL_VIRTUAL_TOKENS);

    let prevClose: number = LAUNCH_PRICE;
    for (const trade of trades) {
      const candleTime =
        Math.floor(trade.timestamp.getTime() / intervalMs) * intervalMs;
      const price = trade.price;

      if (!candles.has(candleTime)) {
        // Use the previous candle's close as open so single-trade candles
        // have a visible body instead of rendering as a zero-height doji.
        const open = prevClose;
        candles.set(candleTime, {
          time: candleTime / 1000, // Unix seconds for lightweight-charts
          open,
          high: Math.max(open, price),
          low:  Math.min(open, price),
          close: price,
          volume: Number(trade.solAmount) / 1e9,
        });
      } else {
        const candle = candles.get(candleTime)!;
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price;
        candle.volume += Number(trade.solAmount) / 1e9;
      }
      prevClose = price;
    }

    const sortedCandles = Array.from(candles.values())
      .sort((a, b) => a.time - b.time)
      .slice(-limit);

    res.json(sortedCandles);
  } catch (error) {
    console.error("GET /tokens/:mint/ohlcv error:", error);
    res.status(500).json({ error: "Failed to fetch OHLCV data" });
  }
});
