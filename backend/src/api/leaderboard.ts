import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { BONDING_CURVE_CONSTANTS } from "../config";

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

    const tokens = await prisma.token.findMany({
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

    // Get PnL for each trader
    const tradersWithPnl = await Promise.all(
      traderStats.map(async (trader, index) => {
        const buyTotal = await prisma.trade.aggregate({
          where: { trader: trader.trader, type: "BUY" },
          _sum: { solAmount: true },
        });
        const sellTotal = await prisma.trade.aggregate({
          where: { trader: trader.trader, type: "SELL" },
          _sum: { solAmount: true },
        });

        const spent = Number(buyTotal._sum.solAmount || 0n) / 1e9;
        const received = Number(sellTotal._sum.solAmount || 0n) / 1e9;

        return {
          rank: index + 1,
          wallet: trader.trader,
          totalVolumeSol: (Number(trader._sum.solAmount || 0n) / 1e9).toFixed(4),
          totalTrades: trader._count.id,
          realizedPnl: (received - spent).toFixed(4),
          pnlPercent: spent > 0 ? (((received - spent) / spent) * 100).toFixed(2) : "0.00",
        };
      })
    );

    res.json(tradersWithPnl);
  } catch (error) {
    console.error("GET /leaderboard/traders error:", error);
    res.status(500).json({ error: "Failed to fetch trader leaderboard" });
  }
});
