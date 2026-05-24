import { Router } from "express";
import { createPublicApiRouter } from "./publicApi";
import { tokensRouter } from "./tokens";
import { tradesRouter } from "./trades";
import { leaderboardRouter } from "./leaderboard";
import { creatorsRouter } from "./creators";
import { commentsRouter } from "./comments";
import { statsRouter } from "./stats";
import { metadataRouter } from "./metadata";
import { uploadRouter } from "./upload";
import { followsRouter } from "./follows";
import { portfolioRouter } from "./portfolio";
import { coingeckoRouter } from "./coingecko";
import authRouter from "./auth";
import referralRouter from "./referral";

export function createRouter(): Router {
  const router = Router();

  router.use("/tokens", tokensRouter);
  router.use("/trades", tradesRouter);
  router.use("/leaderboard", leaderboardRouter);
  router.use("/creators", creatorsRouter);
  router.use("/comments", commentsRouter);
  router.use("/stats", statsRouter);
  router.use("/metadata", metadataRouter);
  router.use("/upload", uploadRouter);
  router.use("/follows", followsRouter);
  router.use("/portfolio", portfolioRouter);
  router.use("/coingecko", coingeckoRouter);
  router.use("/auth", authRouter);
  router.use("/referral", referralRouter);

  // Public API v1 — for third-party integrations
  router.use("/v1", createPublicApiRouter());

  return router;
}
