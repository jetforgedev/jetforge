import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  database: {
    url: process.env.DATABASE_URL || "",
  },
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    wsUrl: process.env.SOLANA_WS_URL || "wss://api.devnet.solana.com",
    programId: process.env.PROGRAM_ID || "TokenLaunchXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    treasuryAddress: process.env.TREASURY_ADDRESS || "TreasuryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  },
  coingeckoApiKey: process.env.COINGECKO_API_KEY || "",
};

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
  REAL_TOKEN_RESERVES_INIT: BigInt("1000000000000000"),
  TOTAL_SUPPLY: BigInt("1000000000000000"),
  GRADUATION_THRESHOLD: BigInt("85000000000"),
  FEE_BPS: BigInt(100),
  BPS_DENOMINATOR: BigInt(10000),
};
