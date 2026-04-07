import { Router, Request, Response } from "express";
import { prisma } from "../index";

export const creatorsRouter = Router();

// Reputation badge thresholds
function getCreatorBadge(tokensLaunched: number, totalVolumeSol: number, graduatedCount: number): {
  badge: string;
  label: string;
  color: string;
} {
  if (graduatedCount >= 3 || totalVolumeSol >= 500) {
    return { badge: "🚀", label: "Rocket Creator", color: "#00ff88" };
  }
  if (graduatedCount >= 1 || totalVolumeSol >= 100) {
    return { badge: "⭐", label: "Rising Star", color: "#FFD700" };
  }
  if (tokensLaunched >= 5 || totalVolumeSol >= 20) {
    return { badge: "🔥", label: "Hot Creator", color: "#ff6b35" };
  }
  if (tokensLaunched >= 2 || totalVolumeSol >= 5) {
    return { badge: "💎", label: "Builder", color: "#7b68ee" };
  }
  return { badge: "🌱", label: "Newcomer", color: "#888" };
}

// GET /api/creators - leaderboard of creators
creatorsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const metric = (req.query.metric as string) || "volume";
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

    // Group tokens by creator, aggregate stats
    const creatorTokens = await prisma.token.groupBy({
      by: ["creator"],
      _count: { mint: true },
      _sum: { volume24h: true, realSolReserves: true },
      orderBy:
        metric === "tokens"
          ? { _count: { mint: "desc" } }
          : { _sum: { volume24h: "desc" } },
      take: limit,
    });

    const results = await Promise.all(
      creatorTokens.map(async (row, index) => {
        // Count graduated tokens for this creator
        const graduated = await prisma.token.count({
          where: { creator: row.creator, isGraduated: true },
        });

        // Latest token
        const latestToken = await prisma.token.findFirst({
          where: { creator: row.creator },
          orderBy: { createdAt: "desc" },
          select: { name: true, symbol: true, imageUrl: true, mint: true },
        });

        // All-time volume from actual trade records
        const [tradeCount, volumeResult] = await Promise.all([
          prisma.trade.count({ where: { token: { creator: row.creator } } }),
          prisma.trade.aggregate({
            where: { token: { creator: row.creator } },
            _sum: { solAmount: true },
          }),
        ]);

        const tokensLaunched = row._count.mint;
        const totalVolumeSol = Number(volumeResult._sum.solAmount ?? 0n) / 1e9;
        const totalRaisedSol = Number(row._sum.realSolReserves ?? 0n) / 1e9;
        // Creator earns 40% of 1% fee = 0.4% of all volume
        const estimatedEarningsSol = totalVolumeSol * 0.004;

        const badge = getCreatorBadge(tokensLaunched, totalVolumeSol, graduated);

        return {
          rank: index + 1,
          wallet: row.creator,
          tokensLaunched,
          totalVolumeSol: totalVolumeSol.toFixed(4),
          totalRaisedSol: totalRaisedSol.toFixed(4),
          estimatedEarningsSol: estimatedEarningsSol.toFixed(4),
          graduatedTokens: graduated,
          totalTrades: tradeCount,
          badge: badge.badge,
          badgeLabel: badge.label,
          badgeColor: badge.color,
          latestToken,
        };
      })
    );

    res.json(results);
  } catch (error) {
    console.error("GET /creators error:", error);
    res.status(500).json({ error: "Failed to fetch creators" });
  }
});

// GET /api/creators/:wallet - single creator profile
creatorsRouter.get("/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    const tokens = await prisma.token.findMany({
      where: { creator: wallet },
      orderBy: { createdAt: "desc" },
      select: {
        mint: true,
        name: true,
        symbol: true,
        imageUrl: true,
        createdAt: true,
        volume24h: true,
        realSolReserves: true,
        isGraduated: true,
        _count: { select: { tradeHistory: true } },
      },
    });

    if (tokens.length === 0) {
      return res.status(404).json({ error: "Creator not found" });
    }

    const totalVolumeSol = tokens.reduce(
      (acc, t) => acc + Number(t.volume24h) / 1e9, 0
    );
    const totalRaisedSol = tokens.reduce(
      (acc, t) => acc + Number(t.realSolReserves) / 1e9, 0
    );
    const graduatedCount = tokens.filter((t) => t.isGraduated).length;
    const estimatedEarningsSol = totalVolumeSol * 0.004;
    const badge = getCreatorBadge(tokens.length, totalVolumeSol, graduatedCount);

    res.json({
      wallet,
      tokensLaunched: tokens.length,
      totalVolumeSol: totalVolumeSol.toFixed(4),
      totalRaisedSol: totalRaisedSol.toFixed(4),
      estimatedEarningsSol: estimatedEarningsSol.toFixed(4),
      graduatedTokens: graduatedCount,
      badge: badge.badge,
      badgeLabel: badge.label,
      badgeColor: badge.color,
      tokens: tokens.map((t) => ({
        mint: t.mint,
        name: t.name,
        symbol: t.symbol,
        imageUrl: t.imageUrl,
        createdAt: t.createdAt,
        volume24h: (Number(t.volume24h) / 1e9).toFixed(4),
        realSolReserves: (Number(t.realSolReserves) / 1e9).toFixed(4),
        isGraduated: t.isGraduated,
        trades: t._count.tradeHistory,
      })),
    });
  } catch (error) {
    console.error("GET /creators/:wallet error:", error);
    res.status(500).json({ error: "Failed to fetch creator profile" });
  }
});
