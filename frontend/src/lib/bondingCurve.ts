import BN from "bn.js";

// Constants matching the Rust program (bonding_curve.rs)
export const INITIAL_VIRTUAL_SOL = new BN("30000000000"); // 30 SOL
export const INITIAL_VIRTUAL_TOKENS = new BN("1073000191000000");
// RESERVE_TOKEN_AMOUNT = 0 in Rust; all 1 T tokens go to the trading vault.
export const REAL_TOKEN_RESERVES_INIT = new BN("1000000000000000");
export const TOTAL_SUPPLY = new BN("1000000000000000");
export const GRADUATION_THRESHOLD = new BN("500000000"); // 0.5 SOL (local testing)
export const FEE_BPS = 100; // 1%
export const BPS_DENOMINATOR = 10_000;

export interface BuyResult {
  tokensOut: BN;
  priceImpact: number; // percentage
  fee: BN;
  newVirtualSol: BN;
  newVirtualTokens: BN;
}

export interface SellResult {
  solOut: BN;
  priceImpact: number; // percentage
  fee: BN;
  newVirtualSol: BN;
  newVirtualTokens: BN;
}

/**
 * Get current price in SOL per token (raw, not human-readable)
 * Returns lamports per token unit (6 decimals)
 */
export function getPrice(virtualSol: BN, virtualTokens: BN): number {
  if (virtualTokens.isZero()) return 0;
  // Price = virtual_sol / virtual_tokens (as a ratio)
  // To get SOL per 1 token (6 dec), multiply by 1e6
  return (
    (virtualSol.toNumber() / virtualTokens.toNumber()) * 1_000_000
  );
}

/**
 * Get price in a human-readable format (SOL per 1 token)
 */
export function getPriceInSol(virtualSol: BN, virtualTokens: BN): number {
  return getPrice(virtualSol, virtualTokens) / 1e9; // Convert lamports to SOL
}

/**
 * Calculate tokens out for a given SOL input
 * Applies 1% fee before curve math
 */
export function getBuyAmount(
  virtualSol: BN,
  virtualTokens: BN,
  solIn: BN, // in lamports
  realTokenReserves?: BN
): BuyResult {
  const fee = solIn.muln(FEE_BPS).divn(BPS_DENOMINATOR);
  const solInAfterFee = solIn.sub(fee);

  const k = virtualSol.mul(virtualTokens);
  const newVirtualSol = virtualSol.add(solInAfterFee);
  const newVirtualTokens = k.div(newVirtualSol);
  const tokensOut = virtualTokens.sub(newVirtualTokens);

  // Clamp to real reserves if provided
  const actualTokensOut =
    realTokenReserves && tokensOut.gt(realTokenReserves)
      ? realTokenReserves
      : tokensOut;

  // Price impact: (newPrice - oldPrice) / oldPrice * 100
  const oldPrice = virtualSol.toNumber() / virtualTokens.toNumber();
  const newPrice = newVirtualSol.toNumber() / newVirtualTokens.toNumber();
  const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;

  return {
    tokensOut: actualTokensOut,
    priceImpact,
    fee,
    newVirtualSol,
    newVirtualTokens,
  };
}

/**
 * Calculate SOL out for a given token input
 * Deducts 1% fee from SOL out
 * Mirrors the Rust contract: caps sol_out at real_sol_reserves
 */
export function getSellAmount(
  virtualSol: BN,
  virtualTokens: BN,
  tokenIn: BN,
  realSolReserves?: BN
): SellResult {
  const k = virtualSol.mul(virtualTokens);
  const newVirtualTokens = virtualTokens.add(tokenIn);
  const newVirtualSol = k.div(newVirtualTokens);
  let solOutBeforeFee = virtualSol.sub(newVirtualSol);

  // Cap at real SOL reserves — matches Rust contract behavior
  if (realSolReserves && solOutBeforeFee.gt(realSolReserves)) {
    solOutBeforeFee = realSolReserves.clone();
  }

  const fee = solOutBeforeFee.muln(FEE_BPS).divn(BPS_DENOMINATOR);
  const solOut = solOutBeforeFee.sub(fee);

  // Price impact
  const oldPrice = virtualSol.toNumber() / virtualTokens.toNumber();
  const newPrice = newVirtualSol.toNumber() / newVirtualTokens.toNumber();
  const priceImpact = ((oldPrice - newPrice) / oldPrice) * 100;

  return {
    solOut,
    priceImpact,
    fee,
    newVirtualSol,
    newVirtualTokens,
  };
}

/**
 * Calculate market cap in SOL
 */
export function getMarketCap(
  virtualSol: BN,
  virtualTokens: BN,
  totalSupply: BN
): number {
  if (virtualTokens.isZero()) return 0;
  // marketCap = (virtualSol / virtualTokens) * totalSupply
  // In SOL: divide lamports by 1e9
  const marketCapLamports =
    (virtualSol.toNumber() * totalSupply.toNumber()) / virtualTokens.toNumber();
  return marketCapLamports / 1e9;
}

/**
 * Get graduation progress percentage (0-100)
 */
export function getGraduationProgress(realSolReserves: BN): number {
  return Math.min(
    100,
    (realSolReserves.toNumber() / GRADUATION_THRESHOLD.toNumber()) * 100
  );
}

/**
 * Calculate min tokens out with slippage
 */
export function applySlippage(amount: BN, slippageBps: number): BN {
  return amount.muln(BPS_DENOMINATOR - slippageBps).divn(BPS_DENOMINATOR);
}

/**
 * Format token amount (6 decimals) to human-readable
 */
export function formatTokenAmount(amount: BN | string | bigint): string {
  const bn = new BN(amount.toString());
  const whole = bn.divn(1_000_000);
  const fraction = bn.modn(1_000_000);
  const fractionStr = fraction.toString().padStart(6, "0").replace(/0+$/, "");
  if (fractionStr) {
    return `${whole.toString()}.${fractionStr}`;
  }
  return whole.toString();
}

/**
 * Format SOL amount (lamports) to human-readable
 */
export function formatSol(lamports: BN | string | number): string {
  const amount = typeof lamports === "number" ? lamports : Number(lamports.toString());
  return (amount / 1e9).toFixed(4);
}

/**
 * Parse human-readable SOL to lamports BN
 */
export function parseSolToLamports(sol: string): BN {
  const parsed = parseFloat(sol);
  if (isNaN(parsed)) return new BN(0);
  return new BN(Math.floor(parsed * 1e9));
}

/**
 * Parse human-readable token amount to raw BN (6 decimals)
 */
export function parseTokenAmount(amount: string): BN {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return new BN(0);
  return new BN(Math.floor(parsed * 1_000_000));
}
