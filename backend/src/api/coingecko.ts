import { Router, Request, Response } from "express";
import { prisma } from "../index";

export const coingeckoRouter = Router();

const SOL_MINT = "So11111111111111111111111111111111111111112";

// Cache SOL/USD price (updated every 10 min)
let cachedSolPriceUsd = 150;
let lastSolPriceFetch = 0;
async function getSolPriceUsd(): Promise<number> {
  if (Date.now() - lastSolPriceFetch < 10 * 60 * 1000) return cachedSolPriceUsd;
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    if (r.ok) {
      const d = (await r.json()) as { solana?: { usd?: number } };
      cachedSolPriceUsd = d?.solana?.usd ?? cachedSolPriceUsd;
      lastSolPriceFetch = Date.now();
    }
  } catch {}
  return cachedSolPriceUsd;
}

/**
 * GET /api/coingecko/pairs
 * Returns top 500 active trading pairs (non-graduated tokens).
 */
coingeckoRouter.get("/pairs", async (_req: Request, res: Response) => {
  try {
    const tokens = await prisma.token.findMany({
      where: { isGraduated: false },
      select: { mint: true, symbol: true, name: true },
      orderBy: { volume24h: "desc" },
      take: 500,
    });

    const pairs = tokens.map((t) => ({
      ticker_id: `${t.mint}_SOL`,
      base: t.symbol,
      target: "SOL",
      pool_id: t.mint,
    }));

    res.json({ pairs });
  } catch (err) {
    console.error("[CoinGecko] /pairs error:", err);
    res.status(500).json({ error: "Failed to fetch pairs" });
  }
});

/**
 * GET /api/coingecko/tickers
 * Returns 24h market data for all active pairs.
 */
coingeckoRouter.get("/tickers", async (_req: Request, res: Response) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const solPriceUsd = await getSolPriceUsd();

    const tokens = await prisma.token.findMany({
      where: { isGraduated: false },
      select: {
        mint: true,
        symbol: true,
        marketCapSol: true,
        volume24h: true,
        virtualSolReserves: true,
        virtualTokenReserves: true,
      },
      orderBy: { volume24h: "desc" },
      take: 500,
    });

    if (tokens.length === 0) return res.json({ tickers: [] });

    const mints = tokens.map((t) => t.mint);

    // Batch aggregate 24h trade data
    const tradeAggs = await prisma.trade.groupBy({
      by: ["mint"],
      where: { mint: { in: mints }, timestamp: { gte: oneDayAgo } },
      _max: { price: true },
      _min: { price: true },
      _sum: { solAmount: true, tokenAmount: true },
    });
    const aggMap = new Map(tradeAggs.map((a) => [a.mint, a]));

    const tickers = tokens.map((t) => {
      const agg = aggMap.get(t.mint);
      const vSol = Number(t.virtualSolReserves);
      const vTok = Number(t.virtualTokenReserves);

      // SOL per whole token from bonding curve reserves
      const lastPrice = vTok > 0 ? (vSol / vTok) / 1e3 : 0;
      const high24h = agg?._max?.price ?? lastPrice;
      const low24h = agg?._min?.price ?? lastPrice;
      const volSol = agg?._sum?.solAmount ? Number(agg._sum.solAmount) / 1e9 : 0;
      const volToken = agg?._sum?.tokenAmount ? Number(agg._sum.tokenAmount) / 1e6 : 0;
      const liquidityUsd = t.marketCapSol * solPriceUsd;

      return {
        ticker_id: `${t.mint}_SOL`,
        base_currency: t.mint,
        target_currency: SOL_MINT,
        last_price: lastPrice.toFixed(12),
        base_volume: volToken.toFixed(2),
        target_volume: volSol.toFixed(6),
        pool_id: t.mint,
        liquidity_in_usd: liquidityUsd.toFixed(2),
        bid: (lastPrice * 0.99).toFixed(12),
        ask: (lastPrice * 1.01).toFixed(12),
        high: high24h.toFixed(12),
        low: low24h.toFixed(12),
      };
    });

    res.json({ tickers });
  } catch (err) {
    console.error("[CoinGecko] /tickers error:", err);
    res.status(500).json({ error: "Failed to fetch tickers" });
  }
});

/**
 * GET /api/coingecko/orderbook?ticker_id={mint}_SOL&depth=10
 * Simulates AMM order book from bonding curve state.
 */
coingeckoRouter.get("/orderbook", async (req: Request, res: Response) => {
  try {
    const tickerId = req.query.ticker_id as string;
    const depth = Math.min(Number(req.query.depth) || 10, 50);

    if (!tickerId) {
      return res.status(400).json({ error: "ticker_id is required" });
    }

    const mint = tickerId.replace(/_SOL$/, "");
    const token = await prisma.token.findUnique({
      where: { mint },
      select: { virtualSolReserves: true, virtualTokenReserves: true },
    });

    if (!token) {
      return res.status(404).json({ error: "Pair not found" });
    }

    const vSol = Number(token.virtualSolReserves);   // lamports
    const vTok = Number(token.virtualTokenReserves); // base units (6 decimals)
    const k = vSol * vTok;
    const pLPU = vSol / vTok; // lamports per base unit

    const bids: [string, string][] = [];
    const asks: [string, string][] = [];
    let prevVTokAbove = vTok;
    let prevVTokBelow = vTok;

    for (let i = 1; i <= depth; i++) {
      const step = i * 0.005; // 0.5% per level

      // Ask: tokens bought to push price up to current * (1 + step)
      const askPLPU = pLPU * (1 + step);
      const vTokAtAsk = Math.sqrt(k / askPLPU);
      const askQty = Math.max(0, (prevVTokAbove - vTokAtAsk) / 1e6);
      asks.push([(askPLPU / 1e3).toFixed(12), askQty.toFixed(2)]);
      prevVTokAbove = vTokAtAsk;

      // Bid: tokens sold to push price down to current * (1 - step)
      const bidPLPU = pLPU * (1 - step);
      if (bidPLPU <= 0) break;
      const vTokAtBid = Math.sqrt(k / bidPLPU);
      const bidQty = Math.max(0, (vTokAtBid - prevVTokBelow) / 1e6);
      bids.push([(bidPLPU / 1e3).toFixed(12), bidQty.toFixed(2)]);
      prevVTokBelow = vTokAtBid;
    }

    res.json({ ticker_id: tickerId, timestamp: Date.now(), bids, asks });
  } catch (err) {
    console.error("[CoinGecko] /orderbook error:", err);
    res.status(500).json({ error: "Failed to fetch orderbook" });
  }
});

/**
 * GET /api/coingecko/historical_trades?ticker_id={mint}_SOL&type=buy|sell&limit=100&start_time=&end_time=
 */
coingeckoRouter.get("/historical_trades", async (req: Request, res: Response) => {
  try {
    const tickerId = req.query.ticker_id as string;
    const tradeType = (req.query.type as string | undefined)?.toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const startTimeSec = req.query.start_time ? Number(req.query.start_time) : undefined;
    const endTimeSec = req.query.end_time ? Number(req.query.end_time) : undefined;

    if (!tickerId) {
      return res.status(400).json({ error: "ticker_id is required" });
    }

    const mint = tickerId.replace(/_SOL$/, "");

    const where: {
      mint: string;
      type?: "BUY" | "SELL";
      timestamp?: { gte?: Date; lte?: Date };
    } = { mint };

    if (tradeType === "buy") where.type = "BUY";
    else if (tradeType === "sell") where.type = "SELL";

    if (startTimeSec || endTimeSec) {
      where.timestamp = {};
      if (startTimeSec) where.timestamp.gte = new Date(startTimeSec * 1000);
      if (endTimeSec) where.timestamp.lte = new Date(endTimeSec * 1000);
    }

    const trades = await prisma.trade.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        price: true,
        solAmount: true,
        tokenAmount: true,
        timestamp: true,
      },
    });

    const result = trades.map((t) => ({
      trade_id: t.id,
      price: t.price.toFixed(12),
      base_volume: (Number(t.tokenAmount) / 1e6).toFixed(2),
      target_volume: (Number(t.solAmount) / 1e9).toFixed(6),
      trade_timestamp: Math.floor(t.timestamp.getTime() / 1000),
      type: t.type.toLowerCase(),
    }));

    res.json(result);
  } catch (err) {
    console.error("[CoinGecko] /historical_trades error:", err);
    res.status(500).json({ error: "Failed to fetch historical trades" });
  }
});
