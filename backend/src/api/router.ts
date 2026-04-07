import { Router } from "express";
import { tokensRouter } from "./tokens";
import { tradesRouter } from "./trades";
import { leaderboardRouter } from "./leaderboard";
import { creatorsRouter } from "./creators";
import { commentsRouter } from "./comments";
import { statsRouter } from "./stats";

export function createRouter(): Router {
  const router = Router();

  router.use("/tokens", tokensRouter);
  router.use("/trades", tradesRouter);
  router.use("/leaderboard", leaderboardRouter);
  router.use("/creators", creatorsRouter);
  router.use("/comments", commentsRouter);
  router.use("/stats", statsRouter);

  return router;
}
