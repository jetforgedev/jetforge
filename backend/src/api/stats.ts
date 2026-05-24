import { Router, Request, Response } from "express";
import { prisma } from "../index";

export const statsRouter = Router();

// GET /api/stats - platform-wide stats for the homepage bar
statsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Sum TradeVolumeBucket instead of scanning all Trade rows — bounded at
    // 1440 × active_mints rows vs potentially millions of individual trades.
    const [totalTokens, bucketSum] = await Promise.all([
      prisma.token.count(),
      (prisma as any).tradeVolumeBucket.aggregate({
        where: { bucketStart: { gte: oneDayAgo } },
        _sum: { volumeLamports: true, trades: true },
      }),
    ]);

    const volume24hSol = Number(bucketSum._sum.volumeLamports ?? 0n) / 1e9;
    const trades24h    = Number(bucketSum._sum.trades ?? 0);

    res.json({
      totalTokens,
      volume24hSol: parseFloat(volume24hSol.toFixed(2)),
      trades24h,
    });
  } catch (error) {
    console.error("GET /stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
