/**
 * Shared Prisma singleton.
 *
 * Import from here instead of creating `new PrismaClient()` in each module.
 * This avoids exhausting the DB connection pool when services are imported
 * by the indexer (which itself is imported by index.ts, making it impossible
 * for services to re-import index.ts without a circular dependency).
 */
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
});
