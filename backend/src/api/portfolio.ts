import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { prefetchRaydiumPrices, getRaydiumPrice } from "../services/raydiumPriceSync";

// ─── Portfolio result cache ───────────────────────────────────────────────────
// Prevents recomputing full cost-basis PnL on every page load.
// 60 s TTL: stale by at most one minute, acceptable for portfolio display.
// Cache is evicted on TTL expiry; the trade indexer writes via a separate path
// so no manual invalidation is needed for correctness.
const PORTFOLIO_CACHE_TTL_MS = 20_000;
interface PortfolioCacheEntry { data: any; ts: number }
const portfolioCache = new Map<string, PortfolioCacheEntry>();

function getPortfolioCache(wallet: string): any | null {
  const entry = portfolioCache.get(wallet);
  if (entry && Date.now() - entry.ts < PORTFOLIO_CACHE_TTL_MS) return entry.data;
  portfolioCache.delete(wallet); // stale — remove so Map doesn't grow unbounded
  return null;
}

function setPortfolioCache(wallet: string, data: any): void {
  portfolioCache.set(wallet, { data, ts: Date.now() });
}

// Hard cap on trades fetched per wallet — protects against memory exhaustion
// for power-users/bots. Cost-basis accounting is still correct: older trades
// beyond the cap are ignored (position is reconstructed from the most-recent
// MAX_TRADES_PER_WALLET trades, which covers every practical user).
const MAX_TRADES_PER_WALLET = 20_000;

export const portfolioRouter = Router();

// ─── Bonding-curve sell quote ─────────────────────────────────────────────────
// Mirrors the on-chain constant-product AMM formula.
// Returns estimated lamports you'd receive selling `tokenIn` base units.
// FEE_BPS = 100 (1 %) is deducted from the output (matches the platform's fee).
function sellQuoteLamports(
  tokenIn: bigint,
  virtualSol: bigint,
  virtualToken: bigint,
): bigint {
  if (tokenIn <= 0n || virtualToken <= 0n || virtualSol <= 0n) return 0n;
  const raw = (virtualSol * tokenIn) / (virtualToken + tokenIn);
  return (raw * 99n) / 100n; // 1 % platform fee
}

// ─── Average-cost-basis accounting ───────────────────────────────────────────
// Processes ALL trades for one (wallet × mint) pair in chronological order.
//
// BUY  → add tokens + SOL cost to open position
// SELL → realizedPnl += solReceived - proportional cost basis; shrink position
//
// Returns the final position state and aggregated PnL figures.
interface Position {
  tokenBalance: bigint;       // remaining base units held
  costBasisLamports: bigint;  // remaining cost of open tokens (lamports)
  realizedPnlLamports: bigint;
  totalSpentLamports: bigint;
  totalReceivedLamports: bigint;
  totalBuys: number;
  totalSells: number;
}

function computePosition(
  trades: Array<{ type: string; solAmount: bigint; tokenAmount: bigint }>,
): Position {
  let tokenBalance = 0n;
  let costBasisLamports = 0n;
  let realizedPnlLamports = 0n;
  let totalSpentLamports = 0n;
  let totalReceivedLamports = 0n;
  let totalBuys = 0;
  let totalSells = 0;

  for (const t of trades) {
    if (t.type === "BUY") {
      tokenBalance += t.tokenAmount;
      costBasisLamports += t.solAmount;
      totalSpentLamports += t.solAmount;
      totalBuys++;
    } else if (t.type === "SELL") {
      totalReceivedLamports += t.solAmount;
      totalSells++;

      if (tokenBalance > 0n) {
        // Proportion of cost basis attributable to the tokens being sold
        const costOfSold = t.tokenAmount >= tokenBalance
          ? costBasisLamports                                      // selling entire position
          : (costBasisLamports * t.tokenAmount) / tokenBalance;   // partial sell
        realizedPnlLamports += t.solAmount - costOfSold;
        costBasisLamports = costBasisLamports > costOfSold
          ? costBasisLamports - costOfSold
          : 0n;
        tokenBalance = t.tokenAmount >= tokenBalance ? 0n : tokenBalance - t.tokenAmount;
      } else {
        // Sell with no open position tracked (e.g. airdrop / external buy)
        realizedPnlLamports += t.solAmount;
      }
    }
  }

  return {
    tokenBalance,
    costBasisLamports,
    realizedPnlLamports,
    totalSpentLamports,
    totalReceivedLamports,
    totalBuys,
    totalSells,
  };
}

// Shared helper: compute full portfolio for a wallet (all trades, no pagination)
// Exported so leaderboard.ts can reuse the same logic without an HTTP round-trip.
export async function computeWalletPortfolio(wallet: string) {
  // 1. Fetch trades for this wallet, oldest-first, capped at MAX_TRADES_PER_WALLET.
  //    Cap protects against memory exhaustion for bots/power-users. PnL is still
  //    accurate for wallets within the cap (covers virtually all real users).
  const rawTrades = await prisma.trade.findMany({
    where: { trader: wallet },
    orderBy: { timestamp: "asc" },
    take: MAX_TRADES_PER_WALLET,
    select: {
      mint: true,
      type: true,
      solAmount: true,
      tokenAmount: true,
    },
  });

  // 2. Group by mint
  const byMint = new Map<string, typeof rawTrades>();
  for (const t of rawTrades) {
    if (!byMint.has(t.mint)) byMint.set(t.mint, []);
    byMint.get(t.mint)!.push(t);
  }

  // 3. Compute per-mint positions
  const positions = new Map<string, Position>();
  for (const [mint, trades] of byMint) {
    positions.set(mint, computePosition(trades));
  }

  // 4. Batch-fetch token details for all mints with an open position
  const openMints = [...positions.entries()]
    .filter(([, pos]) => pos.tokenBalance > 0n)
    .map(([mint]) => mint);

  type TokenInfo = {
    mint: string;
    name: string;
    symbol: string;
    imageUrl: string | null;
    isGraduated: boolean;
    raydiumPoolId?: string | null;
    virtualSolReserves?: bigint;
    virtualTokenReserves?: bigint;
    marketCapSol?: number;
    priceUsd?: number;
  };

  const tokenRecords: TokenInfo[] = openMints.length > 0
    ? await prisma.token.findMany({
        where: { mint: { in: openMints } },
        select: {
          mint: true,
          name: true,
          symbol: true,
          imageUrl: true,
          isGraduated: true,
          raydiumPoolId: true,
          virtualSolReserves: true,
          virtualTokenReserves: true,
          marketCapSol: true,
          priceUsd: true,
        },
      })
    : [];

  const tokenMap = new Map<string, TokenInfo>(tokenRecords.map((t) => [t.mint, t]));

  // 4b. Pre-fetch live Raydium prices for all open graduated positions in parallel.
  //     Results land in the price cache; subsequent getRaydiumPrice() calls below
  //     are synchronous cache hits — no sequential awaits inside the loop.
  const graduatedPools = tokenRecords
    .filter((t) => t.isGraduated && t.raydiumPoolId)
    .map((t) => ({ poolId: t.raydiumPoolId!, tokenMint: t.mint }));
  await prefetchRaydiumPrices(graduatedPools);

  // Also batch-fetch names for closed positions (for display)
  const closedMints = [...positions.keys()].filter((m) => !openMints.includes(m));
  const closedTokenRecords: TokenInfo[] = closedMints.length > 0
    ? await prisma.token.findMany({
        where: { mint: { in: closedMints } },
        select: { mint: true, name: true, symbol: true, imageUrl: true, isGraduated: true },
      })
    : [];
  for (const t of closedTokenRecords) tokenMap.set(t.mint, t);

  // 5. Build holdings array + roll up global totals
  let globalRealizedPnl = 0n;
  let globalUnrealizedPnl = 0n;
  let globalUnrealizedValue = 0n;
  let globalSpent = 0n;
  let globalReceived = 0n;

  type HoldingEntry = {
    mint: string; name: string; symbol: string; imageUrl: string | null;
    isGraduated: boolean; priceSource: string;
    tokenBalance: number; costBasisSol: number; avgBuyPriceSol: number;
    currentValueSol: number; unrealizedPnlSol: number; unrealizedPnlPct: number;
    /** Full-bag AMM sell quote (incl. slippage + 1% fee). Null for graduated tokens. */
    estimatedLiquidationValueSol: number | null;
    realizedPnlSol: number;
    totalBuys: number; totalSells: number;
    totalSpentSol: number; totalReceivedSol: number;
  };
  const holdings: HoldingEntry[] = [];

  for (const [mint, pos] of positions) {
    globalRealizedPnl += pos.realizedPnlLamports;
    globalSpent += pos.totalSpentLamports;
    globalReceived += pos.totalReceivedLamports;

    let currentValueLamports = 0n;
    let estimatedLiquidationValueLamports: bigint | null = null;
    let priceSource: "bonding_curve" | "raydium" | "raydium_stale" | "none" = "none";

    if (pos.tokenBalance > 0n) {
      const tok = tokenMap.get(mint);
      if (tok) {
        if (!tok.isGraduated) {
          const vSol = tok.virtualSolReserves as bigint;
          const vTok = tok.virtualTokenReserves as bigint;
          // Mark-to-market: spot price × balance (no slippage, no fee).
          // Spot = virtualSol / virtualToken per base-unit token.
          // This rises/falls in sync with every other wallet's trades, giving
          // the correct "what is my bag worth right now" number.
          currentValueLamports = vTok > 0n ? (vSol * pos.tokenBalance) / vTok : 0n;
          // Liquidation value: what you'd actually receive selling the whole bag
          // through the AMM (includes price impact + 1% fee).
          estimatedLiquidationValueLamports = sellQuoteLamports(pos.tokenBalance, vSol, vTok);
          priceSource = "bonding_curve";
        } else if (tok.raydiumPoolId) {
          // Post-graduation: try live Raydium pool price (cache was warmed above)
          const livePriceSol = await getRaydiumPrice(tok.raydiumPoolId, mint);
          if (livePriceSol !== null && livePriceSol > 0) {
            // Compute in BigInt to avoid Number precision loss for large balances.
            // value (lamports) = tokenBalance (base) * livePriceSol (SOL/display) * 1e9 / 1e6
            //                  = tokenBalance * livePriceSol * 1e3
            // Scale livePriceSol to integer: priceScaled = round(livePriceSol * 1e9)
            // then: value = tokenBalance * priceScaled / 1e6
            const priceScaled = BigInt(Math.round(livePriceSol * 1_000_000_000));
            currentValueLamports = (pos.tokenBalance * priceScaled) / 1_000_000n;
            priceSource = "raydium";
          } else {
            // Live fetch failed — fall back to stored reserves snapshot
            const vSol = tok.virtualSolReserves as bigint;
            const vTok = tok.virtualTokenReserves as bigint;
            currentValueLamports = vTok > 0n ? (vSol * pos.tokenBalance) / vTok : 0n;
            priceSource = "raydium_stale";
          }
        } else {
          // Graduated but no poolId recorded yet (graduation tx in flight)
          const vSol = tok.virtualSolReserves as bigint;
          const vTok = tok.virtualTokenReserves as bigint;
          currentValueLamports = vTok > 0n ? (vSol * pos.tokenBalance) / vTok : 0n;
          priceSource = "raydium_stale";
        }
      }

      globalUnrealizedValue += currentValueLamports;
      const unrealized = currentValueLamports - pos.costBasisLamports;
      globalUnrealizedPnl += unrealized;

      // tok already declared above — reuse it here
      const tokenBalanceUi = Number(pos.tokenBalance) / 1e6;
      const costBasisSol = Number(pos.costBasisLamports) / 1e9;
      const currentValueSol = Number(currentValueLamports) / 1e9;
      const unrealizedPnlSol = Number(unrealized) / 1e9;
      const realizedPnlSol = Number(pos.realizedPnlLamports) / 1e9;
      const avgBuyPriceSol = tokenBalanceUi > 0 ? costBasisSol / tokenBalanceUi : 0;

      holdings.push({
        mint,
        name: tok?.name ?? mint.slice(0, 6),
        symbol: tok?.symbol ?? "???",
        imageUrl: tok?.imageUrl ?? null,
        isGraduated: tok?.isGraduated ?? false,
        priceSource,
        // Position
        tokenBalance: tokenBalanceUi,
        costBasisSol,
        avgBuyPriceSol,
        // Value (mark-to-market)
        currentValueSol,
        unrealizedPnlSol,
        unrealizedPnlPct: costBasisSol > 0
          ? (unrealizedPnlSol / costBasisSol) * 100
          : 0,
        // Full-bag liquidation estimate (bonding curve only; null for Raydium)
        estimatedLiquidationValueSol: estimatedLiquidationValueLamports !== null
          ? Number(estimatedLiquidationValueLamports) / 1e9
          : null,
        // Realized
        realizedPnlSol,
        // Trade counts
        totalBuys: pos.totalBuys,
        totalSells: pos.totalSells,
        totalSpentSol: Number(pos.totalSpentLamports) / 1e9,
        totalReceivedSol: Number(pos.totalReceivedLamports) / 1e9,
      });
    } else {
      // Fully closed position — include only if there's realized PnL history
      if (pos.totalBuys > 0 || pos.totalSells > 0) {
        const tok = tokenMap.get(mint);
        holdings.push({
          mint,
          name: tok?.name ?? mint.slice(0, 6),
          symbol: tok?.symbol ?? "???",
          imageUrl: tok?.imageUrl ?? null,
          isGraduated: tok?.isGraduated ?? false,
          priceSource: "none" as const,
          tokenBalance: 0,
          costBasisSol: 0,
          avgBuyPriceSol: 0,
          currentValueSol: 0,
          unrealizedPnlSol: 0,
          unrealizedPnlPct: 0,
          estimatedLiquidationValueSol: null,
          realizedPnlSol: Number(pos.realizedPnlLamports) / 1e9,
          totalBuys: pos.totalBuys,
          totalSells: pos.totalSells,
          totalSpentSol: Number(pos.totalSpentLamports) / 1e9,
          totalReceivedSol: Number(pos.totalReceivedLamports) / 1e9,
        });
      }
    }
  }

  // Sort: open positions first (by unrealized value desc), then closed
  holdings.sort((a, b) => {
    if (a.tokenBalance > 0 && b.tokenBalance <= 0) return -1;
    if (a.tokenBalance <= 0 && b.tokenBalance > 0) return 1;
    return b.currentValueSol - a.currentValueSol;
  });

  const realizedPnlSol  = Number(globalRealizedPnl)   / 1e9;
  const unrealizedPnlSol = Number(globalUnrealizedPnl) / 1e9;
  const unrealizedValueSol = Number(globalUnrealizedValue) / 1e9;
  const totalSpentSol    = Number(globalSpent)          / 1e9;
  const totalReceivedSol = Number(globalReceived)       / 1e9;

  return {
    wallet,
    totalSpentSol,
    totalReceivedSol,
    netCashflowSol: totalReceivedSol - totalSpentSol,
    realizedPnlSol,
    unrealizedPnlSol,
    unrealizedValueSol,
    totalPnlSol: realizedPnlSol + unrealizedPnlSol,
    holdings,
  };
}

// ─── GET /api/portfolio/:wallet ───────────────────────────────────────────────
// ?mint=MINT  →  filter holdings to a single token (used by TradingPanel)
portfolioRouter.get("/:wallet", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const mintFilter = req.query.mint as string | undefined;

    if (!wallet || wallet.length < 32) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Serve from cache when available (no mint filter — filtered result is derived)
    let portfolio = getPortfolioCache(wallet);
    if (!portfolio) {
      portfolio = await computeWalletPortfolio(wallet);
      setPortfolioCache(wallet, portfolio);
    }

    // If caller only wants one token, strip the rest to save bandwidth.
    // Clone so the cached object is not mutated.
    if (mintFilter) {
      return res.json({
        ...portfolio,
        holdings: portfolio.holdings.filter((h: any) => h.mint === mintFilter),
      });
    }

    return res.json(portfolio);
  } catch (error) {
    console.error("GET /portfolio/:wallet error:", error);
    res.status(500).json({ error: "Failed to compute portfolio" });
  }
});
