"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import toast from "react-hot-toast";
import BN from "bn.js";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import {
  getBuyAmount,
  getSellAmount,
  parseSolToLamports,
  parseTokenAmount,
  formatTokenAmount,
  formatSol,
  applySlippage,
  INITIAL_VIRTUAL_SOL,
  INITIAL_VIRTUAL_TOKENS,
} from "@/lib/bondingCurve";
import { TokenData, getUserTrades } from "@/lib/api";
import { buildBuyTransaction, buildSellTransaction } from "@/lib/program";

interface TradingPanelProps {
  token: TokenData;
}

const SOL_PRESETS = [0.1, 0.5, 1, 5];
const TOKEN_PRESETS = [25, 50, 75, 100]; // percentage of balance
const DEFAULT_SLIPPAGE_BPS = 100; // 1%

export function TradingPanel({ token }: TradingPanelProps) {
  const { publicKey, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();

  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [inputAmount, setInputAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [showSlippage, setShowSlippage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [solBalance, setSolBalance] = useState(0);
  const [tokenBalance, setTokenBalance] = useState<BN>(new BN(0));

  const virtualSol = new BN(token.virtualSolReserves);
  const virtualTokens = new BN(token.virtualTokenReserves);
  const realTokenReserves = new BN(token.realTokenReserves);
  const realSolReserves = new BN(token.realSolReserves);

  // Fetch user's trade history for this token to compute avg buy price
  const { data: tradeHistory } = useQuery({
    queryKey: ["user-trades-for-token", token.mint, publicKey?.toString()],
    queryFn: () => getUserTrades(publicKey!.toString()),
    enabled: !!publicKey && tab === "sell",
    staleTime: 30_000,
  });

  // Compute avg buy price (SOL per token, display units) for this specific token
  const avgBuyPriceSol = useMemo(() => {
    if (!tradeHistory?.trades) return null;
    const mintTrades = tradeHistory.trades.filter((t) => t.mint === token.mint);
    let totalSolSpent = 0;
    let totalTokensBought = 0;
    for (const t of mintTrades) {
      if (t.type === "BUY") {
        totalSolSpent += Number(t.solAmount) / 1e9;
        totalTokensBought += Number(t.tokenAmount) / 1_000_000;
      }
    }
    if (totalTokensBought === 0) return null;
    return totalSolSpent / totalTokensBought; // SOL per 1 token
  }, [tradeHistory, token.mint]);

  // Fetch balances
  useEffect(() => {
    if (!publicKey) return;

    const fetchBalances = async () => {
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / 1e9);

      // Fetch token balance
      try {
        const mint = new PublicKey(token.mint);
        const ata = getAssociatedTokenAddressSync(mint, publicKey);
        const tokenAcct = await connection.getTokenAccountBalance(ata);
        setTokenBalance(new BN(tokenAcct.value.amount));
      } catch {
        setTokenBalance(new BN(0));
      }
    };

    fetchBalances();
    const id = setInterval(fetchBalances, 15_000);
    return () => clearInterval(id);
  }, [publicKey, connection, token.mint]);

  // Calculate output amount
  const calculation = (() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) return null;

    try {
      if (tab === "buy") {
        const solIn = parseSolToLamports(inputAmount);
        const result = getBuyAmount(virtualSol, virtualTokens, solIn, realTokenReserves);
        return {
          output: formatTokenAmount(result.tokensOut),
          priceImpact: result.priceImpact,
          fee: formatSol(result.fee),
          minOut: applySlippage(result.tokensOut, slippageBps),
          isValid: result.tokensOut.gtn(0),
        };
      } else {
        const tokenIn = parseTokenAmount(inputAmount);
        const result = getSellAmount(virtualSol, virtualTokens, tokenIn, realSolReserves);
        return {
          output: formatSol(result.solOut),
          priceImpact: result.priceImpact,
          fee: formatSol(result.fee),
          minOut: applySlippage(result.solOut, slippageBps),
          isValid: result.solOut.gtn(0),
        };
      }
    } catch {
      return null;
    }
  })();

  const handlePresetBuy = (sol: number) => {
    setInputAmount(sol.toString());
  };

  const handlePresetSell = (pct: number) => {
    const amount = tokenBalance.muln(pct).divn(100);
    setInputAmount(formatTokenAmount(amount));
  };

  // Map raw error messages to user-friendly text
  const friendlyError = (err: any): string => {
    const msg: string = err?.message ?? "Transaction failed";

    if (msg.includes("User rejected") || msg.includes("rejected the request") || msg.includes("Transaction cancelled"))
      return "Transaction cancelled";
    if (msg.includes("WalletSignTransactionError") || msg.includes("signing"))
      return "Wallet signing failed — try again";
    if (msg.includes("Failed to fetch") || msg.includes("Network Error") || msg.includes("ECONNREFUSED") || msg.includes("timeout"))
      return "Network error — check your connection";
    if (msg.includes("SlippageExceeded") || msg.includes("6000") || msg.includes("0x1770"))
      return "Slippage exceeded — increase slippage tolerance and retry";
    if (msg.includes("CurveComplete") || msg.includes("AlreadyGraduated") || msg.includes("TokenGraduated") || msg.includes("0x1771") || msg.includes("0x1772"))
      return "Token has graduated — trade on the DEX";
    if (msg.includes("insufficient funds") || msg.includes("Insufficient funds") || msg.includes("0x1"))
      return "Insufficient SOL balance";
    if (msg.includes("InsufficientTokens") || msg.includes("0x1773"))
      return "Insufficient token balance";
    if (msg.includes("Simulation failed:")) {
      // Strip noisy prefix, show only the meaningful program log line
      const clean = msg
        .replace("Simulation failed: Program log: Panicked at", "Program error:")
        .replace("Simulation failed: Program log: ", "")
        .replace("Simulation failed: ", "");
      return clean.length > 120 ? clean.slice(0, 120) + "…" : clean;
    }
    const anchorMatch = msg.match(/custom program error: (0x[0-9a-fA-F]+)/);
    if (anchorMatch) return `Transaction failed (code ${anchorMatch[1]})`;
    return msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
  };

  const handleTrade = useCallback(async () => {
    if (!publicKey || !anchorWallet) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    if (token.isGraduated) {
      toast.error("Token has graduated — trade on the DEX");
      return;
    }
    if (!calculation?.isValid) {
      toast.error("Invalid amount");
      return;
    }

    // Pre-flight balance checks — catch obvious failures before sending
    if (tab === "buy") {
      const solNeeded = parseFloat(inputAmount) * 1.015; // amount + 1% fee + ~0.5% tx buffer
      if (solNeeded > solBalance) {
        toast.error(
          solBalance < 0.001
            ? "Your SOL balance is empty — fund your wallet to trade"
            : `Insufficient SOL — you need ~${solNeeded.toFixed(3)} SOL but have ${solBalance.toFixed(3)} SOL`
        );
        return;
      }
    } else {
      const tokenIn = parseTokenAmount(inputAmount);
      if (tokenIn.gt(tokenBalance)) {
        toast.error(
          tokenBalance.isZero()
            ? `You don't hold any ${token.symbol}`
            : `Insufficient ${token.symbol} balance`
        );
        return;
      }
    }

    setIsLoading(true);
    const loadingToast = toast.loading(
      tab === "buy" ? "Buying tokens..." : "Selling tokens..."
    );

    try {
      let tx;

      if (tab === "buy") {
        const solAmountLamports = parseSolToLamports(inputAmount);
        const buyResult = getBuyAmount(virtualSol, virtualTokens, solAmountLamports, realTokenReserves);
        const minTokensOut = applySlippage(buyResult.tokensOut, slippageBps);

        tx = await buildBuyTransaction({
          connection,
          wallet: anchorWallet,
          mintAddress: token.mint,
          creatorAddress: token.creator,
          solAmountLamports,
          minTokensOut,
        });
      } else {
        const tokenAmountRaw = parseTokenAmount(inputAmount);
        const sellResult = getSellAmount(virtualSol, virtualTokens, tokenAmountRaw, realSolReserves);
        const minSolOut = applySlippage(sellResult.solOut, slippageBps);

        tx = await buildSellTransaction({
          connection,
          wallet: anchorWallet,
          mintAddress: token.mint,
          creatorAddress: token.creator,
          tokenAmountRaw,
          minSolOut,
        });
      }

      // Simulate to get a real error message before sending
      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        const logs = sim.value.logs ?? [];
        console.error("Simulation failed:", sim.value.err, "\nLogs:\n", logs.join("\n"));
        // Find the most meaningful log line
        const errLine =
          logs.find((l) => l.includes("Program log: Error") || l.includes("AnchorError")) ??
          logs.find((l) => l.includes("Error") || l.includes("failed")) ??
          JSON.stringify(sim.value.err);
        throw new Error(`Simulation failed: ${errLine}`);
      }

      const sig = await sendTransaction(tx, connection, { skipPreflight: true });
      await connection.confirmTransaction(sig, "confirmed");

      toast.dismiss(loadingToast);
      toast.success(
        <span>
          {tab === "buy" ? "Bought" : "Sold"} successfully!{" "}
          <a
            href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View tx
          </a>
        </span>,
        { duration: 6000 }
      );
      setInputAmount("");

      // Refresh balances after trade
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / 1e9);
      try {
        const { PublicKey: PK } = await import("@solana/web3.js");
        const { getAssociatedTokenAddressSync: getAta } = await import("@solana/spl-token");
        const ata = getAta(new PK(token.mint), publicKey);
        const tokenAcct = await connection.getTokenAccountBalance(ata);
        setTokenBalance(new BN(tokenAcct.value.amount));
      } catch {
        // ATA may not exist yet
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, anchorWallet, inputAmount, tab, token, slippageBps, sendTransaction, connection, calculation, virtualSol, virtualTokens, realTokenReserves, solBalance, tokenBalance]);

  const highImpact = calculation && calculation.priceImpact > 5;

  return (
    <div className="glass-panel rounded-[28px] overflow-hidden">
      {/* Tab Header */}
      {token.isGraduated ? (
        <div className="p-4 space-y-3">
          <div className="text-center py-2">
            <div className="text-2xl mb-2">🎓</div>
            <div className="text-white font-semibold text-sm mb-1">Graduated to DEX</div>
            <div className="text-[#666] text-xs mb-2">This token no longer trades on the bonding curve.</div>
          </div>
          <a
            href={`https://raydium.io/swap/?inputMint=sol&outputMint=${token.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#7c3aed50] bg-[#7c3aed20] py-3 text-sm font-semibold text-[#c4b5fd] transition-colors hover:bg-[#7c3aed35]"
          >
            Trade on Raydium ↗
          </a>
        </div>
      ) : (
      <><div className="flex gap-1 p-1.5">
        <button
          onClick={() => { setTab("buy"); setInputAmount(""); }}
          className={clsx(
            "relative flex-1 rounded-2xl py-3 text-sm font-semibold transition-all",
            tab === "buy"
              ? "bg-[#00ff88]/10 text-[#00ff88] shadow-[inset_0_0_0_1px_rgba(0,255,136,0.35),0_0_22px_rgba(0,255,136,0.12)]"
              : "text-white/40 hover:text-white border border-transparent"
          )}
        >
          Buy
        </button>
        <button
          onClick={() => { setTab("sell"); setInputAmount(""); }}
          className={clsx(
            "relative flex-1 rounded-2xl py-3 text-sm font-semibold transition-all",
            tab === "sell"
              ? "bg-[#ff4444]/10 text-[#ff7b88] shadow-[inset_0_0_0_1px_rgba(255,68,68,0.35),0_0_22px_rgba(255,68,68,0.12)]"
              : "text-white/40 hover:text-white border border-transparent"
          )}
        >
          Sell
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* Preset amounts */}
        {tab === "buy" && (
          <div className="flex gap-2">
            {SOL_PRESETS.map((sol) => (
              <button
                key={sol}
                onClick={() => handlePresetBuy(sol)}
                className={clsx(
                  "flex-1 rounded-xl border py-1.5 text-xs transition-colors",
                  inputAmount === sol.toString()
                    ? "bg-[#00ff88]/12 border-[#00ff88]/40 text-[#00ff88]"
                    : "bg-white/[0.04] border-white/10 text-white/48 hover:border-white/20 hover:text-white"
                )}
              >
                {sol} SOL
              </button>
            ))}
          </div>
        )}

        {tab === "sell" && tokenBalance.gtn(0) && (
          <div className="flex gap-2">
            {TOKEN_PRESETS.map((pct) => (
              <button
                key={pct}
                onClick={() => handlePresetSell(pct)}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 text-xs text-white/48 transition-colors hover:border-white/20 hover:text-white"
              >
                {pct}%
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-white/40">
            <span>{tab === "buy" ? "Amount (SOL)" : `Amount (${token.symbol})`}</span>
            <span>
              Balance:{" "}
              {tab === "buy"
                ? `${solBalance.toFixed(3)} SOL`
                : `${formatTokenAmount(tokenBalance)} ${token.symbol}`}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder={tab === "buy" ? "0.0 SOL" : `0 ${token.symbol}`}
              className="input-field pr-16"
              min="0"
              step={tab === "buy" ? "0.01" : "1"}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-white/32">
              {tab === "buy" ? "SOL" : token.symbol}
            </div>
          </div>
        </div>

        {/* Output preview */}
        {calculation && (() => {
          // PnL calculation for sell tab
          let pnlSol: number | null = null;
          let pnlPct: number | null = null;
          if (tab === "sell" && avgBuyPriceSol !== null && inputAmount && parseFloat(inputAmount) > 0) {
            const tokensBeingSold = parseFloat(inputAmount);
            const solReceiving = parseFloat(calculation.output);
            const costBasis = tokensBeingSold * avgBuyPriceSol;
            pnlSol = solReceiving - costBasis;
            pnlPct = costBasis > 0 ? (pnlSol / costBasis) * 100 : null;
          }

          return (
            <div className="space-y-2 rounded-[20px] border border-white/8 bg-white/[0.04] p-3">
              <div className="flex justify-between text-xs">
                <span className="text-white/42">You receive</span>
                <span className="text-white font-mono font-medium">
                  {calculation.output} {tab === "buy" ? token.symbol : "SOL"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/42">Fee (1%)</span>
                <span className="font-mono text-white/42">{calculation.fee} SOL</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/42">Price Impact</span>
                <span
                  className={clsx(
                    "font-mono",
                    highImpact ? "text-[#ff4444] font-bold" : "text-[#888]"
                  )}
                >
                  {calculation.priceImpact.toFixed(2)}%
                  {highImpact && " ⚠️"}
                </span>
              </div>
              {tab === "sell" && pnlSol !== null && (
                <div className="flex justify-between border-t border-white/8 pt-1 text-xs">
                  <span className="text-white/42">Est. PnL</span>
                  <span className={clsx("font-mono font-semibold", pnlSol >= 0 ? "text-[#00ff88]" : "text-[#ff4444]")}>
                    {pnlSol >= 0 ? "+" : ""}{pnlSol.toFixed(4)} SOL
                    {pnlPct !== null && ` (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%)`}
                  </span>
                </div>
              )}
              {tab === "sell" && avgBuyPriceSol !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Avg buy price</span>
                  <span className="font-mono text-white/30">{avgBuyPriceSol.toFixed(6)} SOL/token</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* High impact warning */}
        {highImpact && (
          <div className="rounded-[20px] border border-[#ff444430] bg-[#ff444415] p-3 text-xs text-[#ff7b88]">
            ⚠️ High price impact ({calculation!.priceImpact.toFixed(1)}%). Consider splitting into smaller trades.
          </div>
        )}

        {/* Insufficient balance warning (inline) */}
        {publicKey && inputAmount && parseFloat(inputAmount) > 0 && (
          tab === "buy" && parseFloat(inputAmount) * 1.015 > solBalance ? (
            <div className="rounded-[20px] border border-[#ff444430] bg-[#ff444415] p-3 text-xs text-[#ff7b88]">
              {solBalance < 0.001
                ? "Your SOL balance is empty. Fund your wallet to trade."
                : `Insufficient SOL — need ~${(parseFloat(inputAmount) * 1.015).toFixed(3)} SOL, have ${solBalance.toFixed(3)} SOL.`}
            </div>
          ) : tab === "sell" && parseTokenAmount(inputAmount).gt(tokenBalance) ? (
            <div className="rounded-[20px] border border-[#ff444430] bg-[#ff444415] p-3 text-xs text-[#ff7b88]">
              {tokenBalance.isZero()
                ? `You don't hold any ${token.symbol}.`
                : `Insufficient ${token.symbol} balance.`}
            </div>
          ) : null
        )}

        {/* Slippage settings */}
        <div>
          <button
            onClick={() => setShowSlippage(!showSlippage)}
            className="flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/70"
          >
            <span>Slippage: {(slippageBps / 100).toFixed(1)}%</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              className={clsx("transition-transform", showSlippage && "rotate-180")}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </button>

          {showSlippage && (
            <div className="mt-2 flex gap-2">
              {[50, 100, 200, 500].map((bps) => (
                <button
                  key={bps}
                  onClick={() => setSlippageBps(bps)}
                  className={clsx(
                    "flex-1 rounded-xl border py-1 text-xs transition-colors",
                    slippageBps === bps
                      ? "bg-[#00ff88]/12 border-[#00ff88]/40 text-[#00ff88]"
                      : "bg-white/[0.04] border-white/10 text-white/40"
                  )}
                >
                  {bps / 100}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Trade button */}
        <button
          onClick={handleTrade}
          disabled={isLoading || !publicKey || !inputAmount || parseFloat(inputAmount) <= 0 || token.isGraduated}
          className={clsx(
            "w-full rounded-2xl py-3.5 text-sm font-bold transition-all",
            tab === "buy"
              ? "bg-[linear-gradient(90deg,#00ff88,#00e5ff)] text-[#03110d] shadow-[0_16px_38px_rgba(0,255,136,0.22)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
              : "bg-[linear-gradient(90deg,#ff5b6e,#ff8a5b)] text-white shadow-[0_16px_38px_rgba(255,91,110,0.18)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : !publicKey ? (
            "Connect Wallet"
          ) : tab === "buy" ? (
            `Buy ${token.symbol}`
          ) : (
            `Sell ${token.symbol}`
          )}
        </button>
      </div>
      </>
      )}
    </div>
  );
}
