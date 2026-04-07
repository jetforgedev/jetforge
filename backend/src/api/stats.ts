import { Router, Request, Response } from "express";
import { prisma } from "../index";

export const statsRouter = Router();

// GET /api/stats - platform-wide stats for the homepage bar
statsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalTokens, vol24hResult, trades24hResult] = await Promise.all([
      prisma.token.count(),
      prisma.trade.aggregate({
        where: { timestamp: { gte: oneDayAgo } },
        _sum: { solAmount: true },
      }),
      prisma.trade.count({
        where: { timestamp: { gte: oneDayAgo } },
      }),
    ]);

    const volume24hSol = Number(vol24hResult._sum.solAmount ?? 0n) / 1e9;

    res.json({
      totalTokens,
      volume24hSol: parseFloat(volume24hSol.toFixed(2)),
      trades24h: trades24hResult,
    });
  } catch (error) {
    console.error("GET /stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
