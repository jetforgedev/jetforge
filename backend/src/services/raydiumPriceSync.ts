/**
 * Raydium CPMM live price fetching.
 *
 * Used by the portfolio endpoint to value graduated-token holdings at current
 * Raydium pool reserves rather than the frozen on-chain bonding-curve snapshot.
 *
 * Design:
 *  - Singleton Raydium SDK instance (lazy init, read-only, no owner needed)
 *  - Per-pool price cache with 60 s TTL
 *  - Returns null on any failure → callers fall back to stored reserves
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Raydium } = require("@raydium-io/raydium-sdk-v2");

import { Connection } from "@solana/web3.js";
import { config } from "../config";

// ─── Constants ────────────────────────────────────────────────────────────────
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const CACHE_TTL_MS = 60_000; // 60 s — balances are updated by each Raydium swap

// ─── In-memory price cache ────────────────────────────────────────────────────
interface PriceCacheEntry {
  /** SOL per 1 display-unit token (i.e. per 1e6 base units for 6-decimal tokens) */
  priceSolPerToken: number;
  ts: number;
}

const priceCache = new Map<string, PriceCacheEntry>();

// ─── Singleton Raydium instance ───────────────────────────────────────────────
let _connection: Connection | null = null;
let _raydium: any = null;
let _raydiumInitPromise: Promise<any> | null = null;

function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(config.solana.rpcUrl, "confirmed");
  }
  return _connection;
}

async function getRaydiumInstance(): Promise<any> {
  if (_raydium) return _raydium;
  if (_raydiumInitPromise) return _raydiumInitPromise;

  const isDevnet = config.solana.rpcUrl.includes("devnet");
  const cluster = isDevnet ? "devnet" : "mainnet";
  const connection = getConnection();

  _raydiumInitPromise = Raydium.load({
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: true,  // skip slow token registry load — not needed for price
  }).then((r: any) => {
    _raydium = r;
    _raydiumInitPromise = null;
    console.log(`[RAYDIUM_PRICE] SDK ready on ${cluster}`);
    return r;
  });

  return _raydiumInitPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch the live Raydium CPMM pool price for a graduated token.
 *
 * @param poolId    Raydium CPMM pool public key (stored as token.raydiumPoolId)
 * @param tokenMint Token's mint address — used to distinguish WSOL vs token vault
 * @returns         SOL per 1 display-unit token, or null if the fetch failed
 */
export async function getRaydiumPrice(
  poolId: string,
  tokenMint: string,
): Promise<number | null> {
  // ── Cache hit ──────────────────────────────────────────────────────────────
  const cached = priceCache.get(poolId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.priceSolPerToken;
  }

  try {
    const raydium = await getRaydiumInstance();
    // getPoolInfoFromRpc fetches and decodes the CPMM pool state from on-chain.
    // Returns { poolInfo, poolKeys, rpcData }.
    const { poolInfo } = await raydium.cpmm.getPoolInfoFromRpc(poolId);

    // mintA / mintB are TokenInfo objects: { address: string, decimals: number }
    const mintAAddr: string =
      typeof poolInfo.mintA === "string" ? poolInfo.mintA : poolInfo.mintA?.address;
    const mintBAddr: string =
      typeof poolInfo.mintB === "string" ? poolInfo.mintB : poolInfo.mintB?.address;

    const decimalsA: number = poolInfo.mintA?.decimals ?? 9;
    const decimalsB: number = poolInfo.mintB?.decimals ?? 6;

    // mintAAmount / mintBAmount — may be BN (has .toNumber()), bigint, or number
    function toNumber(v: any): number {
      if (typeof v === "number") return v;
      if (typeof v === "bigint") return Number(v);
      if (v && typeof v.toNumber === "function") return v.toNumber();
      if (v && typeof v.toString === "function") return Number(v.toString());
      return 0;
    }

    const amountA = toNumber(poolInfo.mintAAmount ?? poolInfo.baseReserve);
    const amountB = toNumber(poolInfo.mintBAmount ?? poolInfo.quoteReserve);

    // Identify which side is WSOL
    let solBaseUnits: number, tokenBaseUnits: number;
    let tokenDecimals: number;

    if (mintAAddr === WSOL_MINT) {
      solBaseUnits   = amountA;
      tokenBaseUnits = amountB;
      tokenDecimals  = decimalsB;
    } else if (mintBAddr === WSOL_MINT) {
      solBaseUnits   = amountB;
      tokenBaseUnits = amountA;
      tokenDecimals  = decimalsA;
    } else {
      console.warn(
        `[RAYDIUM_PRICE] Pool ${poolId.slice(0, 8)}: neither side is WSOL ` +
        `(mintA=${mintAAddr?.slice(0, 8)}, mintB=${mintBAddr?.slice(0, 8)}) — skip`,
      );
      return null;
    }

    if (tokenBaseUnits <= 0) return null;

    // price = SOL / display-token = (solLamports/1e9) / (tokenBase/10^decimals)
    const priceSolPerToken =
      (solBaseUnits / 1e9) / (tokenBaseUnits / Math.pow(10, tokenDecimals));

    priceCache.set(poolId, { priceSolPerToken, ts: Date.now() });
    console.log(
      `[RAYDIUM_PRICE] Pool ${poolId.slice(0, 8)}: ` +
      `${priceSolPerToken.toExponential(4)} SOL/token`,
    );
    return priceSolPerToken;
  } catch (err: any) {
    console.warn(
      `[RAYDIUM_PRICE] Failed to fetch pool ${poolId.slice(0, 8)}: ` +
      (err?.message ?? err)?.toString?.()?.slice(0, 150),
    );
    return null;
  }
}

/**
 * Prefetch prices for several pools in parallel (warms the cache).
 * Call this before iterating holdings so every graduated token gets a single
 * concurrent RPC round-trip rather than sequential awaits in a loop.
 */
export async function prefetchRaydiumPrices(
  pools: Array<{ poolId: string; tokenMint: string }>,
): Promise<void> {
  if (pools.length === 0) return;
  await Promise.allSettled(
    pools.map(({ poolId, tokenMint }) => getRaydiumPrice(poolId, tokenMint)),
  );
}

/**
 * Convert a token balance (in base units) to a SOL value in lamports using
 * the live Raydium pool price.  Returns null to signal "use stale fallback".
 *
 * @param poolId       Raydium CPMM pool ID
 * @param tokenMint    Token mint address
 * @param tokenBalance Balance in base units (token decimals = 6 → 1e6 per token)
 */
export async function getPositionValueLamports(
  poolId: string,
  tokenMint: string,
  tokenBalance: bigint,
): Promise<bigint | null> {
  const priceSol = await getRaydiumPrice(poolId, tokenMint);
  if (priceSol === null || priceSol <= 0) return null;

  // tokenBalance is base units; priceSol is SOL per display-unit (1e6 base)
  const displayTokens = Number(tokenBalance) / 1e6;
  const lamports = Math.round(displayTokens * priceSol * 1e9);
  return BigInt(lamports);
}
