import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { BONDING_CURVE_CONSTANTS } from "../config";
import { computeWalletPortfolio } from "./portfolio";

export const leaderboardRouter = Router();

// GET /api/leaderboard/tokens - top tokens
leaderboardRouter.get("/tokens", async (req: Request, res: Response) => {
  try {
    const metric = (req.query.metric as string) || "volume";
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

    let orderBy: any;
    switch (metric) {
      case "marketcap":
        orderBy = [{ marketCapSol: "desc" }, { createdAt: "desc" }];
        break;
      case "trades":
        orderBy = [{ trades: "desc" }, { createdAt: "desc" }];
        break;
      case "new":
        orderBy = { createdAt: "desc" };
        break;
      case "volume":
      default:
        orderBy = [{ volume24h: "desc" }, { createdAt: "desc" }];
        break;
    }

    // KotH uses excludeGraduated=true so only tradeable tokens appear
    const excludeGraduated = req.query.excludeGraduated === "true";
    const whereClause = excludeGraduated ? { isGraduated: false } : {};

    const tokens = await prisma.token.findMany({
      where: whereClause,
      orderBy,
      take: limit,
      select: {
        mint: true,
        name: true,
        symbol: true,
        imageUrl: true,
        creator: true,
        createdAt: true,
        marketCapSol: true,
        volume24h: true,
        trades: true,
        isGraduated: true,
        realSolReserves: true,
        virtualSolReserves: true,
        virtualTokenReserves: true,
        _count: { select: { tradeHistory: true } },
      },
    });

    const formatted = tokens.map((token, index) => ({
      rank: index + 1,
      mint: token.mint,
      name: token.name,
      symbol: token.symbol,
      imageUrl: token.imageUrl,
      creator: token.creator,
      createdAt: token.createdAt,
      marketCapSol: token.marketCapSol,
      volume24h: token.volume24h,
      trades: token._count.tradeHistory,
      isGraduated: token.isGraduated,
      realSolReserves: token.realSolReserves.toString(),
      virtualSolReserves: token.virtualSolReserves.toString(),
      virtualTokenReserves: token.virtualTokenReserves.toString(),
      graduationProgress:
        (Number(token.realSolReserves) / Number(BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD)) * 100,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("GET /leaderboard/tokens error:", error);
    res.status(500).json({ error: "Failed to fetch token leaderboard" });
  }
});

// GET /api/leaderboard/traders - top traders
leaderboardRouter.get("/traders", async (req: Request, res: Response) => {
  try {
    const metric = (req.query.metric as string) || "volume";
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

    // Aggregate by trader
    const traderStats = await prisma.trade.groupBy({
      by: ["trader"],
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
    // Fetch ALL trades for the top-N wallets in ONE query (ordered oldest→newest
    // so cost-basis accounting is chronologically correct), then compute
    // per-trader realized PnL in memory. This avoids N+1 DB round-trips.
    const walletList = traderStats.map((t) => t.trader);
    const allTrades = await prisma.trade.findMany({
      where: { trader: { in: walletList } },
      orderBy: { timestamp: "asc" },
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

    res.json(tradersWithPnl);
  } catch (error) {
    console.error("GET /leaderboard/traders error:", error);
    res.status(500).json({ error: "Failed to fetch trader leaderboard" });
  }
});
