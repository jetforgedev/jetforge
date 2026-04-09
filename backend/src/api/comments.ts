import { Router, Request, Response } from "express";
import { createVerify, createPublicKey } from "crypto";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { prisma } from "../index";
import { broadcastComment } from "../websocket/index";

export const commentsRouter = Router();

// Ed25519 SPKI DER header (fixed prefix for 32-byte public keys)
const ED25519_SPKI_HEADER = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Verify a Solana wallet signature.
 * The frontend must sign: `"JetForge comment\nmint: {mint}\ntext: {text}"`
 */
function verifyWalletSignature(walletBase58: string, message: string, signatureBase64: string): boolean {
  try {
    const pubkeyBytes = Buffer.from(new PublicKey(walletBase58).toBytes());
    const spkiDer = Buffer.concat([ED25519_SPKI_HEADER, pubkeyBytes]);
    const keyObject = createPublicKey({ key: spkiDer, format: "der", type: "spki" });
    const msgBytes = Buffer.from(message, "utf-8");
    const sigBytes = Buffer.from(signatureBase64, "base64");
    return createVerify("Ed25519").update(msgBytes).verify(keyObject, sigBytes);
  } catch {
    return false;
  }
}

export function buildCommentMessage(mint: string, text: string): string {
  return `JetForge comment\nmint: ${mint}\ntext: ${text}`;
}

const postSchema = z.object({
  wallet: z.string().min(32).max(44),
  text: z.string().min(1).max(280),
  signature: z.string().min(1), // base64 Ed25519 signature
});

// GET /api/comments/:mint — latest 100 comments
commentsRouter.get("/:mint", async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    const comments = await prisma.comment.findMany({
      where: { mint },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    res.json({ comments });
  } catch (error) {
    console.error("GET /comments/:mint error:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/comments/:mint — post a new comment
commentsRouter.post("/:mint", async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    const data = postSchema.parse(req.body);

    // Verify the wallet actually signed this comment
    const message = buildCommentMessage(mint, data.text);
    if (!verifyWalletSignature(data.wallet, message, data.signature)) {
      return res.status(401).json({ error: "Invalid wallet signature" });
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
