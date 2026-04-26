import dotenv from "dotenv";
dotenv.config();

// ─── DEVNET-TEST MODE ─────────────────────────────────────────────────────────
// RPC defaults intentionally point to Solana devnet for local testing.
// Before mainnet: set SOLANA_RPC_URL and SOLANA_WS_URL to a paid mainnet RPC.
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  port: parseInt(process.env.PORT || "4000"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  database: {
    url: process.env.DATABASE_URL || "",
  },
  solana: {
    // DEVNET-TEST: defaults to public devnet RPC. Override via .env for mainnet.
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    wsUrl: process.env.SOLANA_WS_URL || "wss://api.devnet.solana.com",
    programId: process.env.PROGRAM_ID || "TokenLaunchXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    treasuryAddress: process.env.TREASURY_ADDRESS || "TreasuryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  },
  coingeckoApiKey: process.env.COINGECKO_API_KEY || "",
};

// Fail fast if DATABASE_URL is missing — Prisma silently fails at query time otherwise.
if (!config.database.url) {
  throw new Error(
    "DATABASE_URL is not set in .env — refusing to start without a database connection."
  );
}

// Fail fast if critical env vars are still set to placeholder values
if (config.solana.programId.includes("XXX")) {
  throw new Error(
    "PROGRAM_ID is not set in .env — refusing to start with placeholder value."
  );
}
if (config.solana.treasuryAddress.includes("XXX")) {
  throw new Error(
    "TREASURY_ADDRESS is not set in .env — refusing to start with placeholder value."
  );
}

export const BONDING_CURVE_CONSTANTS = {
  INITIAL_VIRTUAL_SOL: BigInt("30000000000"),
  INITIAL_VIRTUAL_TOKENS: BigInt("1073000191000000"),
  // 70/30 model: 700M on bonding curve, 300M locked for Raydium
  REAL_TOKEN_RESERVES_INIT: BigInt("700000000000000"),
  RESERVE_TOKEN_AMOUNT: BigInt("300000000000000"),
  TOTAL_SUPPLY: BigInt("1000000000000000"),
  // DEVNET-TEST: 0.5 SOL threshold by default (matches current on-chain devnet program).
  // Override via env var:  GRADUATION_THRESHOLD_LAMPORTS=85000000000
  // BEFORE MAINNET: recompile program with 85_000_000_000 (85 SOL) and set the env var.
  GRADUATION_THRESHOLD: BigInt(process.env.GRADUATION_THRESHOLD_LAMPORTS ?? "500000000"),
  FEE_BPS: BigInt(100),
  BPS_DENOMINATOR: BigInt(10000),
};

// ─── Production safety guards ─────────────────────────────────────────────────

// Guard 1: Prevent launching mainnet with the devnet 0.5 SOL graduation threshold.
// Devnet keeps the default 0.5 SOL (no action required).
// Mainnet requires GRADUATION_THRESHOLD_LAMPORTS=85000000000 in .env.
if (process.env.NODE_ENV === "production") {
  const thresholdSol = Number(BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD) / 1e9;
  if (thresholdSol < 80) {
    throw new Error(
      `[SAFETY] GRADUATION_THRESHOLD is ${thresholdSol} SOL — too low for production. ` +
      `Set GRADUATION_THRESHOLD_LAMPORTS=85000000000 in .env before going to mainnet.`,
    );
  }
}

// Guard 2: Prevent WebSocket/HTTP CORS from rejecting all browser connections in production.
if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
  throw new Error(
    "[SAFETY] FRONTEND_URL is not set in .env — WebSocket and HTTP CORS will reject all " +
    "browser connections in production.",
  );
}
