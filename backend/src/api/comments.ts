import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../index";
import { broadcastComment } from "../websocket/index";

export const commentsRouter = Router();

const postSchema = z.object({
  wallet: z.string().min(32).max(44),
  text: z.string().min(1).max(280),
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

    const token = await prisma.token.findUnique({ where: { mint } });
    if (!token) return res.status(404).json({ error: "Token not found" });

    const comment = await prisma.comment.create({
      data: { mint, wallet: data.wallet, text: data.text },
    });

    // Lazy import to avoid circular dependency (io is initialized after router)
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
