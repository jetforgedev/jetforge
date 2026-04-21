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
  // DEVNET-TEST: 0.5 SOL threshold for fast flow testing.
  // BEFORE MAINNET: recompile program with 85_000_000_000 (85 SOL) and update this value.
  GRADUATION_THRESHOLD: BigInt("500000000"),
  FEE_BPS: BigInt(100),
  BPS_DENOMINATOR: BigInt(10000),
};
