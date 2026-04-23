import { Router } from "express";
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

  return router;
}
