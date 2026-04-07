import { Router, Request, Response } from "express";
import { z } from "zod";
import { Connection, PublicKey } from "@solana/web3.js";
import { prisma } from "../index";
import { BONDING_CURVE_CONSTANTS, config } from "../config";

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

// GET /api/tokens - list tokens with sorting
tokensRouter.get("/", async (req: Request, res: Response) => {
  try {
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
        orderBy = { volume24h: "desc" };
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
        include: {
          _count: {
            select: { tradeHistory: true },
          },
        },
      }),
      prisma.token.count({ where }),
    ]);

    const formattedTokens = tokens.map((token) => {
      const { id: _id, _count, ...rest } = token as any;
      return {
        ...rest,
        virtualSolReserves: token.virtualSolReserves.toString(),
        virtualTokenReserves: token.virtualTokenReserves.toString(),
        realSolReserves: token.realSolReserves.toString(),
        realTokenReserves: token.realTokenReserves.toString(),
        totalSupply: token.totalSupply.toString(),
        trades: _count.tradeHistory,
        currentPrice: computePrice(token.virtualSolReserves, token.virtualTokenReserves),
        graduationProgress:
          (Number(token.realSolReserves) /
            Number(BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD)) *
          100,
      };
    });

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

    // Get 24h volume
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTrades = await prisma.trade.aggregate({
      where: {
        mint,
        timestamp: { gte: oneDayAgo },
      },
      _sum: { solAmount: true },
      _count: true,
    });

    // Get holder count (unique traders)
    const holdersResult = await prisma.trade.groupBy({
      by: ["trader"],
      where: { mint },
    });

    const marketCapSol = computeMarketCap(
      token.virtualSolReserves,
      token.virtualTokenReserves,
      token.totalSupply
    );

    const { id: _id, _count, ...tokenRest } = token as any;
    const formatted = {
      ...tokenRest,
      virtualSolReserves: token.virtualSolReserves.toString(),
      virtualTokenReserves: token.virtualTokenReserves.toString(),
      realSolReserves: token.realSolReserves.toString(),
      realTokenReserves: token.realTokenReserves.toString(),
      totalSupply: token.totalSupply.toString(),
      marketCapSol,
      volume24h: recentTrades._sum.solAmount
        ? Number(recentTrades._sum.solAmount) / 1e9
        : 0,
      holders: holdersResult.length,
      totalTrades: _count.tradeHistory,
      graduationProgress:
        (Number(token.realSolReserves) /
          Number(BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD)) *
        100,
      currentPrice: computePrice(
        token.virtualSolReserves,
        token.virtualTokenReserves
      ),
    };

    res.json(formatted);
  } catch (error) {
    console.error("GET /tokens/:mint error:", error);
    res.status(500).json({ error: "Failed to fetch token" });
  }
});

// POST /api/tokens - create token record (called after on-chain creation)
tokensRouter.post("/", async (req: Request, res: Response) => {
  try {
    const data = createTokenSchema.parse(req.body);

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

// GET /api/tokens/:mint/holders - top 10 token holders from Solana RPC
tokensRouter.get("/:mint/holders", async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    const mintPubkey = new PublicKey(mint);
    const connection = new Connection(config.solana.rpcUrl, "confirmed");

    // Get token's totalSupply from DB (raw units with 6 decimals)
    const tokenRecord = await prisma.token.findUnique({
      where: { mint },
      select: { totalSupply: true },
    });
    // Convert raw totalSupply to UI units (divide by 10^6 for 6 decimals)
    const totalSupplyUi = tokenRecord
      ? Number(tokenRecord.totalSupply) / 1e6
      : Number(BONDING_CURVE_CONSTANTS.TOTAL_SUPPLY) / 1e6;

    // Fetch top 20 largest token accounts for this mint
    const largest = await connection.getTokenLargestAccounts(mintPubkey);
    const accounts = largest.value.slice(0, 10);

    // Resolve the owner of each token account
    const holdersWithOwners = await Promise.all(
      accounts.map(async (acct) => {
        try {
          const info = await connection.getParsedAccountInfo(acct.address);
          const parsed = (info.value?.data as any)?.parsed;
          const owner: string = parsed?.info?.owner ?? acct.address.toBase58();
          const amount = Number(acct.uiAmount ?? 0);
          const pct = (amount / totalSupplyUi) * 100;
          return { wallet: owner, amount, pct };
        } catch {
          const amount = Number(acct.uiAmount ?? 0);
          return {
            wallet: acct.address.toBase58(),
            amount,
            pct: (amount / totalSupplyUi) * 100,
          };
        }
      })
    );

    res.json({ holders: holdersWithOwners });
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

    const trades = await prisma.trade.findMany({
      where: { mint },
      orderBy: { timestamp: "asc" },
      take: limit * 10, // Get more raw trades to aggregate
    });

    if (trades.length === 0) {
      return res.json([]);
    }

    // Aggregate into OHLCV candles
    const candles = new Map<number, {
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>();

    for (const trade of trades) {
      const candleTime =
        Math.floor(trade.timestamp.getTime() / intervalMs) * intervalMs;
      const price = trade.price;

      if (!candles.has(candleTime)) {
        candles.set(candleTime, {
          time: candleTime / 1000, // Unix seconds for lightweight-charts
          open: price,
          high: price,
          low: price,
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
