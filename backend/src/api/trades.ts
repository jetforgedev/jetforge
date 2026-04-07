import { Router, Request, Response } from "express";
import { prisma } from "../index";

export const tradesRouter = Router();

const PAGE_SIZE = 50;

// GET /api/trades/user/:wallet - trades by wallet address
// IMPORTANT: this route must be registered BEFORE /:mint so Express doesn't
// swallow "user" as a mint address.
tradesRouter.get("/user/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || PAGE_SIZE);
    const skip = (page - 1) * limit;

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where: { trader: wallet },
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
        include: {
          token: {
            select: {
              name: true,
              symbol: true,
              imageUrl: true,
            },
          },
        },
      }),
      prisma.trade.count({ where: { trader: wallet } }),
    ]);

    const formatted = trades.map((trade) => ({
      ...trade,
      solAmount: trade.solAmount.toString(),
      tokenAmount: trade.tokenAmount.toString(),
      fee: trade.fee.toString(),
    }));

    const buyTrades = await prisma.trade.aggregate({
      where: { trader: wallet, type: "BUY" },
      _sum: { solAmount: true },
      _count: true,
    });

    const sellTrades = await prisma.trade.aggregate({
      where: { trader: wallet, type: "SELL" },
      _sum: { solAmount: true },
      _count: true,
    });

    const totalSpent = buyTrades._sum.solAmount || 0n;
    const totalReceived = sellTrades._sum.solAmount || 0n;

    res.json({
      trades: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      summary: {
        totalBuys: buyTrades._count,
        totalSells: sellTrades._count,
        totalSpentSol: (Number(totalSpent) / 1e9).toFixed(4),
        totalReceivedSol: (Number(totalReceived) / 1e9).toFixed(4),
        realizedPnl: (
          (Number(totalReceived) - Number(totalSpent)) /
          1e9
        ).toFixed(4),
      },
    });
  } catch (error) {
    console.error("GET /trades/user/:wallet error:", error);
    res.status(500).json({ error: "Failed to fetch user trades" });
  }
});

// GET /api/trades/recent - latest trades across all tokens (for live feed seeding)
tradesRouter.get("/recent", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

    const trades = await prisma.trade.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        token: {
          select: { name: true, symbol: true, imageUrl: true },
        },
      },
    });

    const formatted = trades.map((trade) => ({
      id: trade.id,
      type: trade.type,
      mint: trade.mint,
      trader: trade.trader,
      solAmount: trade.solAmount.toString(),
      tokenAmount: trade.tokenAmount.toString(),
      price: trade.price,
      timestamp: Math.floor(trade.timestamp.getTime() / 1000),
      tokenName: trade.token?.name,
      tokenSymbol: trade.token?.symbol,
      tokenImageUrl: trade.token?.imageUrl ?? undefined,
    }));

    res.json({ trades: formatted });
  } catch (error) {
    console.error("GET /trades/recent error:", error);
    res.status(500).json({ error: "Failed to fetch recent trades" });
  }
});

// GET /api/trades/:mint - trade history for a token
tradesRouter.get("/:mint", async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || PAGE_SIZE);
    const skip = (page - 1) * limit;

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where: { mint },
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
      prisma.trade.count({ where: { mint } }),
    ]);

    const formatted = trades.map((trade) => ({
      ...trade,
      solAmount: trade.solAmount.toString(),
      tokenAmount: trade.tokenAmount.toString(),
      fee: trade.fee.toString(),
    }));

    res.json({
      trades: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /trades/:mint error:", error);
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

