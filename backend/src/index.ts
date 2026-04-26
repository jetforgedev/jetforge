import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { createServer } from "http";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import rateLimit from "express-rate-limit";

import { config } from "./config";
import { createRouter } from "./api/router";
import { initWebSocket } from "./websocket/index";
import { startIndexer, stopIndexer } from "./indexer/index";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Trust the first proxy hop (nginx). "1" avoids express-rate-limit's
// ERR_ERL_PERMISSIVE_TRUST_PROXY validation error thrown when set to true.
app.set("trust proxy", 1);

// Initialize Prisma
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
});

// Middleware
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — general API: 300 req/min per IP.
// A trading platform legitimately generates high read traffic: multiple browser
// tabs each polling token/ohlcv/holders on 10-30s intervals, plus WebSocket
// clients. 300/min = 5 req/s, plenty of headroom without opening the door to
// trivial scraping.
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." },
  })
);

// Stricter limit for WRITE endpoints only: 20 req/min per IP.
// Applies only to POST/PUT/DELETE — never to GETs — so read-heavy polling
// (token list, ohlcv, holders) is never blocked by this limiter.
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});
app.use(["/api/tokens", "/api/comments", "/api/upload"], writeLimiter);

// Health check — includes DB ping so load balancers can detect DB connectivity loss
app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || "development" });
  } catch {
    res.status(503).json({ status: "error", detail: "db unreachable" });
  }
});

// Serve uploaded images — __dirname (dist/) is reliable in PM2 cluster mode;
// process.cwd() returns /root when exec_cwd is not set, causing 404s.
const UPLOAD_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

// API routes
app.use("/api", createRouter());

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Initialize WebSocket
const io = initWebSocket(httpServer);

// Export io for use in other modules
export { io };

// Start server
const start = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log("Database connected successfully");

    httpServer.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
      console.log(`WebSocket server ready`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });

    // Start blockchain indexer only on PM2 instance 0 (or when not in cluster
    // mode) to avoid duplicate Solana subscriptions and double socket emissions.
    // All cluster instances share the same HTTP/WebSocket port via Node's
    // cluster module, so broadcasts from instance 0 reach all connected clients.
    const instanceId = process.env.NODE_APP_INSTANCE;
    if (instanceId === undefined || instanceId === "0") {
      startIndexer(io).catch((err) => {
        console.error("Indexer error:", err);
      });
    } else {
      console.log(`[Indexer] Skipping on cluster instance ${instanceId} — instance 0 handles indexing`);
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  stopIndexer();

  httpServer.close(() => {
    console.log("HTTP server closed");
  });

  await prisma.$disconnect();
  console.log("Database disconnected");

  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
