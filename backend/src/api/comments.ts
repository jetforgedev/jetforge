import { Router, Request, Response } from "express";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { prisma } from "../index";
import { broadcastComment } from "../websocket/index";

export const commentsRouter = Router();

const PAGE_SIZE = 20;

// Validates a base58 Solana public key
function isValidSolanaAddress(addr: string): boolean {
  try {
    const pk = new PublicKey(addr);
    return PublicKey.isOnCurve(pk.toBytes());
  } catch {
    return false;
  }
}

// Verifies a Solana wallet signature over a message
function verifyWalletSignature(wallet: string, message: string, signature: string): boolean {
  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signature);
    const pubkeyBytes = new PublicKey(wallet).toBytes();
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
  } catch {
    return false;
  }
}

const postSchema = z.object({
  wallet: z.string().min(32).max(44),
  text: z.string().min(1).max(280),
  signature: z.string().min(1),
  message: z.string().min(1),
});

// GET /api/comments/:mint — paginated comments
commentsRouter.get("/:mint", async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(req.query.limit as string) || PAGE_SIZE));
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { mint },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip,
      }),
      prisma.comment.count({ where: { mint } }),
    ]);
    res.json({ comments, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("GET /comments/:mint error:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/comments/:mint — post a new comment (requires wallet signature)
commentsRouter.post("/:mint", async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    const data = postSchema.parse(req.body);

    // Validate Solana address format
    if (!isValidSolanaAddress(data.wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Verify the wallet actually signed this message
    if (!verifyWalletSignature(data.wallet, data.message, data.signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Message must contain the mint to prevent replay across tokens
    if (!data.message.includes(mint)) {
      return res.status(400).json({ error: "Message does not reference this token" });
    }

    const token = await prisma.token.findUnique({ where: { mint } });
    if (!token) return res.status(404).json({ error: "Token not found" });

    const comment = await prisma.comment.create({
      data: { mint, wallet: data.wallet, text: data.text },
    });

    const { io } = await import("../index");
    broadcastComment(io, comment);
    res.status(201).json(comment);
  } catch (error) {
    if ((error as any)?.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input" });
    }
    console.error("POST /comments/:mint error:", error);
    res.status(500).json({ error: "Failed to post comment" });
  }
});
