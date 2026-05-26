import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { BONDING_CURVE_CONSTANTS } from "../config";

// ─── Leaderboard caches ───────────────────────────────────────────────────────
// Token leaderboard: cheap query (findMany, no join) — cache for 5 s so rapid
// consecutive requests don't hammer the DB but KoTH/home page get near-live data.
// Trader leaderboard: aggregates the full Trade table — expensive, cache for 60 s.
const TOKEN_LB_CACHE_TTL_MS  =  5_000;
const TRADER_LB_CACHE_TTL_MS = 60_000;
interface LBCacheEntry { data: any; ts: number }
const tokenLBCache  = new Map<string, LBCacheEntry>(); // key = metric
const traderLBCache = new Map<string, LBCacheEntry>(); // key = metric

function getLBCache(map: Map<string, LBCacheEntry>, key: string, ttl: number): any | null {
  const entry = map.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  map.delete(key);
  return null;
}
function setLBCache(map: Map<string, LBCacheEntry>, key: string, data: any): void {
  map.set(key, { data, ts: Date.now() });
}

// Cap trades fetched for PnL computation. Top traders on mainnet may have
// 10k+ trades; fetching all of them for 20 wallets simultaneously is unsafe.
const MAX_TRADES_FOR_PNL = 50_000; // across all top-N wallets combined

export const leaderboardRouter = Router();

// Period helper — returns Date cutoff or null for "all time"
function periodSince(period: string): Date | null {
  const hours: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
  const h = hours[period];
  return h ? new Date(Date.now() - h * 3_600_000) : null;
}

// GET /api/leaderboard/tokens - top tokens
leaderboardRouter.get("/tokens", async (req: Request, res: Response) => {
  try {
    const metric = (req.query.metric as string) || "volume";
    const period = (req.query.period as string) || "24h";
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const excludeGraduated = req.query.excludeGraduated === "true";
    const cacheKey = `${metric}:${period}:${limit}:${excludeGraduated}`;

    const cached = getLBCache(tokenLBCache, cacheKey, TOKEN_LB_CACHE_TTL_MS);
    if (cached) return res.json(cached);

    const since = periodSince(period);
    const baseWhere = excludeGraduated ? { isGraduated: false } : {};
    const tokenSelect = {
      mint: true, name: true, symbol: true, imageUrl: true,
      creator: true, createdAt: true, marketCapSol: true,
      volume24h: true, trades: true, isGraduated: true,
      realSolReserves: true, virtualSolReserves: true, virtualTokenReserves: true,
      _count: { select: { tradeHistory: true } },
    };

    let tokens: any[];

    // For volume sort with a non-24h period: aggregate from Trade table
    if (metric === "volume" && period !== "24h") {
      const tradeWhere: any = since ? { timestamp: { gte: since } } : {};
      if (excludeGraduated) {
        // filter mints to non-graduated only via subquery approach
        const graduated = await prisma.token.findMany({
          where: { isGraduated: true }, select: { mint: true },
        });
        const gradMints = graduated.map((t: any) => t.mint);
        if (gradMints.length > 0) tradeWhere.mint = { notIn: gradMints };
      }

      const volumeByMint = await prisma.trade.groupBy({
        by: ["mint"],
        where: tradeWhere,
        _sum: { solAmount: true },
        orderBy: { _sum: { solAmount: "desc" } },
        take: limit,
      });

      const mints = volumeByMint.map((r: any) => r.mint);
      // solAmount is stored in lamports — convert to SOL here so volumePeriod is in SOL everywhere
      const volMap = new Map(volumeByMint.map((r: any) => [r.mint, Number(r._sum.solAmount || 0n) / 1e9]));

      const rows = await prisma.token.findMany({
        where: { mint: { in: mints }, ...baseWhere },
        select: tokenSelect,
      });

      // Restore trade-sorted order
      const rowMap = new Map(rows.map((r: any) => [r.mint, r]));
      tokens = mints.map((m: string) => rowMap.get(m)).filter(Boolean).map((t: any, i: number) => ({
        rank: i + 1, mint: t.mint, name: t.name, symbol: t.symbol,
        imageUrl: t.imageUrl, creator: t.creator, createdAt: t.createdAt,
        marketCapSol: t.marketCapSol,
        volumePeriod: volMap.get(t.mint) ?? 0,
        volume24h: t.volume24h,
        trades: t._count.tradeHistory, isGraduated: t.isGraduated,
        realSolReserves: t.realSolReserves.toString(),
        virtualSolReserves: t.virtualSolReserves.toString(),
        virtualTokenReserves: t.virtualTokenReserves.toString(),
        graduationProgress: (Number(t.realSolReserves) / Number(BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD)) * 100,
      }));
    } else {
      let orderBy: any;
      switch (metric) {
        case "marketcap": orderBy = [{ marketCapSol: "desc" }, { createdAt: "desc" }]; break;
        case "trades":    orderBy = [{ tradeHistory: { _count: "desc" } }, { createdAt: "desc" }]; break;
        case "new":       orderBy = { createdAt: "desc" }; break;
        default:          orderBy = [{ volume24h: "desc" }, { createdAt: "desc" }]; break;
      }

      const rows = await prisma.token.findMany({
        where: baseWhere, orderBy, take: limit, select: tokenSelect,
      });

      // For non-volume sorts: still compute volumePeriod from trades if period != 24h
      let periodVolMap = new Map<string, number>();
      if (period !== "24h" && rows.length > 0) {
        const tradeWhere: any = { mint: { in: rows.map((r: any) => r.mint) } };
        if (since) tradeWhere.timestamp = { gte: since };
        const vols = await prisma.trade.groupBy({
          by: ["mint"], where: tradeWhere, _sum: { solAmount: true },
        });
        // solAmount is in lamports — convert to SOL so volumePeriod is always in SOL
        periodVolMap = new Map(vols.map((v: any) => [v.mint, Number(v._sum.solAmount || 0n) / 1e9]));
      }

      tokens = rows.map((t: any, i: number) => ({
        rank: i + 1, mint: t.mint, name: t.name, symbol: t.symbol,
        imageUrl: t.imageUrl, creator: t.creator, createdAt: t.createdAt,
        marketCapSol: t.marketCapSol,
        volumePeriod: period === "24h" ? Number(t.volume24h) : (periodVolMap.get(t.mint) ?? 0),
        volume24h: t.volume24h,
        trades: t._count.tradeHistory, isGraduated: t.isGraduated,
        realSolReserves: t.realSolReserves.toString(),
        virtualSolReserves: t.virtualSolReserves.toString(),
        virtualTokenReserves: t.virtualTokenReserves.toString(),
        graduationProgress: (Number(t.realSolReserves) / Number(BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD)) * 100,
      }));
    }

    setLBCache(tokenLBCache, cacheKey, tokens);
    res.json(tokens);
  } catch (error) {
    console.error("GET /leaderboard/tokens error:", error);
    res.status(500).json({ error: "Failed to fetch token leaderboard" });
  }
});

// GET /api/leaderboard/traders - top traders
leaderboardRouter.get("/traders", async (req: Request, res: Response) => {
  try {
    const metric = (req.query.metric as string) || "volume";
    const period = (req.query.period as string) || "24h";
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const cacheKey = `${metric}:${period}:${limit}`;

    const cached = getLBCache(traderLBCache, cacheKey, TRADER_LB_CACHE_TTL_MS);
    if (cached) return res.json(cached);

    const since = periodSince(period);
    const tradeWhere: any = since ? { timestamp: { gte: since } } : {};

    // Aggregate by trader
    const traderStats = await prisma.trade.groupBy({
      by: ["trader"],
      where: tradeWhere,
      _sum: {
        solAmount: true,
        tokenAmount: true,
      },
      _count: {
        id: true,
      },
      orderBy:
        metric === "trades"
          ? { _count: { id: "desc" } }
          : { _sum: { solAmount: "desc" } },
      take: limit,
    });

    // Compute proper cost-basis realized PnL for each trader.
    // Fetch trades for the top-N wallets in ONE query (ordered oldest→newest
    // so cost-basis accounting is chronologically correct), then compute
    // per-trader realized PnL in memory. This avoids N+1 DB round-trips.
    // Capped at MAX_TRADES_FOR_PNL total rows to prevent memory exhaustion
    // when top traders have very large trade histories.
    const walletList = traderStats.map((t) => t.trader);
    const allTrades = await prisma.trade.findMany({
      where: { trader: { in: walletList }, ...tradeWhere },
      orderBy: { timestamp: "asc" },
      take: MAX_TRADES_FOR_PNL,
      select: { trader: true, mint: true, type: true, solAmount: true, tokenAmount: true },
    });

    // Group trades by (wallet → mint → [trades])
    const tradesByWallet = new Map<string, Map<string, typeof allTrades>>();
    for (const t of allTrades) {
      if (!tradesByWallet.has(t.trader)) tradesByWallet.set(t.trader, new Map());
      const byMint = tradesByWallet.get(t.trader)!;
      if (!byMint.has(t.mint)) byMint.set(t.mint, []);
      byMint.get(t.mint)!.push(t);
    }

    // Inline average-cost PnL (same logic as portfolio.ts computePosition)
    function realizedPnlForWallet(wallet: string): number {
      const byMint = tradesByWallet.get(wallet);
      if (!byMint) return 0;
      let total = 0n;
      for (const trades of byMint.values()) {
        let tokenBal = 0n, costBasis = 0n;
        for (const t of trades) {
          if (t.type === "BUY") {
            tokenBal += t.tokenAmount;
            costBasis += t.solAmount;
          } else if (t.type === "SELL") {
            if (tokenBal > 0n) {
              const costOfSold = t.tokenAmount >= tokenBal
                ? costBasis
                : (costBasis * t.tokenAmount) / tokenBal;
              total += t.solAmount - costOfSold;
              costBasis = t.tokenAmount >= tokenBal ? 0n : costBasis - costOfSold;
              tokenBal = t.tokenAmount >= tokenBal ? 0n : tokenBal - t.tokenAmount;
            } else {
              total += t.solAmount; // no open position — treat as pure gain
            }
          }
        }
      }
      return Number(total) / 1e9;
    }

    const tradersWithPnl = traderStats.map((trader, index) => {
      const totalVolumeSol = Number(trader._sum.solAmount || 0n) / 1e9;
      const realizedPnl = realizedPnlForWallet(trader.trader);
      // pnlPercent relative to total buy volume for this wallet
      const buyVol = allTrades
        .filter((t) => t.trader === trader.trader && t.type === "BUY")
        .reduce((s, t) => s + Number(t.solAmount), 0) / 1e9;

      return {
        rank: index + 1,
        wallet: trader.trader,
        totalVolumeSol: totalVolumeSol.toFixed(4),
        totalTrades: trader._count.id,
        realizedPnlSol: realizedPnl.toFixed(4),
        pnlPercent: buyVol > 0 ? ((realizedPnl / buyVol) * 100).toFixed(2) : "0.00",
      };
    });

    setLBCache(traderLBCache, cacheKey, tradersWithPnl);
    res.json(tradersWithPnl);
  } catch (error) {
    console.error("GET /leaderboard/traders error:", error);
    res.status(500).json({ error: "Failed to fetch trader leaderboard" });
  }
});
