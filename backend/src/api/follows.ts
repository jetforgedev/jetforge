import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { PublicKey } from "@solana/web3.js";

export const followsRouter = Router();

function isValidWallet(addr: string): boolean {
  try { new PublicKey(addr); return true; } catch { return false; }
}

// POST /api/follows  { follower, following }
followsRouter.post("/", async (req: Request, res: Response) => {
  const { follower, following } = req.body;
  if (!follower || !following || !isValidWallet(follower) || !isValidWallet(following)) {
    return res.status(400).json({ error: "Invalid wallet addresses" });
  }
  if (follower === following) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }
  try {
    await prisma.follow.upsert({
      where: { follower_following: { follower, following } },
      create: { follower, following },
      update: {},
    });
    const count = await prisma.follow.count({ where: { following } });
    res.json({ following: true, followerCount: count });
  } catch (e) {
    res.status(500).json({ error: "Failed to follow" });
  }
});

// DELETE /api/follows  { follower, following }
followsRouter.delete("/", async (req: Request, res: Response) => {
  const { follower, following } = req.body;
  if (!follower || !following) return res.status(400).json({ error: "Missing fields" });
  try {
    await prisma.follow.deleteMany({ where: { follower, following } });
    const count = await prisma.follow.count({ where: { following } });
    res.json({ following: false, followerCount: count });
  } catch (e) {
    res.status(500).json({ error: "Failed to unfollow" });
  }
});

// GET /api/follows/:wallet/stats?viewer=<walletOrEmpty>
// Returns follower count, following count, and whether viewer follows this wallet
followsRouter.get("/:wallet/stats", async (req: Request, res: Response) => {
  const { wallet } = req.params;
  const viewer = req.query.viewer as string | undefined;
  if (!isValidWallet(wallet)) return res.status(400).json({ error: "Invalid wallet" });
  try {
    const [followerCount, followingCount, isFollowing] = await Promise.all([
      prisma.follow.count({ where: { following: wallet } }),
      prisma.follow.count({ where: { follower: wallet } }),
      viewer && isValidWallet(viewer)
        ? prisma.follow.findUnique({ where: { follower_following: { follower: viewer, following: wallet } } })
        : Promise.resolve(null),
    ]);
    res.json({ followerCount, followingCount, isFollowing: !!isFollowing });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /api/follows/:wallet/followers?page=1
followsRouter.get("/:wallet/followers", async (req: Request, res: Response) => {
  const { wallet } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;
  if (!isValidWallet(wallet)) return res.status(400).json({ error: "Invalid wallet" });
  try {
    const [rows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { following: wallet },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: { follower: true, createdAt: true },
      }),
      prisma.follow.count({ where: { following: wallet } }),
    ]);
    res.json({ followers: rows, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

// GET /api/follows/:wallet/following?page=1
followsRouter.get("/:wallet/following", async (req: Request, res: Response) => {
  const { wallet } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;
  if (!isValidWallet(wallet)) return res.status(400).json({ error: "Invalid wallet" });
  try {
    const [rows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { follower: wallet },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: { following: true, createdAt: true },
      }),
      prisma.follow.count({ where: { follower: wallet } }),
    ]);
    res.json({ following: rows, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch following" });
  }
});
