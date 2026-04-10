import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { createServer } from "http";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

import { config } from "./config";
import { createRouter } from "./api/router";
import { initWebSocket } from "./websocket/index";
import { startIndexer } from "./indexer/index";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Trust reverse proxy (nginx) so req.protocol reflects X-Forwarded-Proto
app.set("trust proxy", true);

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

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Serve uploaded images
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
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

    // Start blockchain indexer
    startIndexer(io).catch((err) => {
      console.error("Indexer error:", err);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

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
