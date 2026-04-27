"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import toast from "react-hot-toast";
import BN from "bn.js";
import { clsx } from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { TokenData, getPortfolio, fmtTokenPrice } from "@/lib/api";
import { buildBuyTransaction, buildSellTransaction } from "@/lib/program";
import { useSocket } from "@/hooks/useLiveFeed";

interface TradingPanelProps {
  token: TokenData;
}

const SOL_PRESETS = [0.1, 0.5, 1, 5];
const TOKEN_PRESETS = [25, 50, 75, 100]; // percentage of balance
const DEFAULT_SLIPPAGE_BPS = 50; // 0.5% — tighter default makes sandwich attacks harder

/** FOMO hint under the Buy button — tap/hover tooltip, works on mobile */
function BuyCurveHint() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-center gap-1 mt-1.5">
      <span className="text-[10px] text-white/30 leading-4">
        📈 Price increases as more users buy
      </span>
      <span className="relative inline-flex items-center">
        <button
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen((v) => !v)}
          className="text-[10px] text-[#444] hover:text-[#666] cursor-help leading-none select-none"
          aria-label="Price info"
        >
          ⓘ
        </button>
        {open && (
          <span className="absolute bottom-full right-0 mb-2 z-50 w-48 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] px-3 py-2 text-[11px] text-[#aaa] shadow-2xl pointer-events-none leading-[1.6] whitespace-normal">
            Price follows a bonding curve. Earlier buyers get lower prices.
          </span>
        )}
      </span>
    </div>
  );
}

// HTTP-polling confirmation — more reliable than WebSocket subscriptions which
// can silently hang on Helius devnet. Polls getSignatureStatus every 1.5 s for
// up to `timeoutMs`, then does a final history-search check before giving up.
async function pollConfirmation(
  connection: import("@solana/web3.js").Connection,
  signature: string,
  timeoutMs = 60_000
): Promise<void> {
  const INTERVAL = 1_500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: false,
    });
    if (value?.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(value.err)}`);
    if (value?.confirmationStatus === "confirmed" || value?.confirmationStatus === "finalized") return;
    await new Promise((r) => setTimeout(r, INTERVAL));
  }

  // Final check: search transaction history in case the node was slightly behind
  const { value: final } = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });
  if (final?.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(final.err)}`);
  if (final?.confirmationStatus === "confirmed" || final?.confirmationStatus === "finalized") return;

  throw new Error(
    `Transaction sent but not confirmed within ${timeoutMs / 1000}s. ` +
    `Check on explorer: ${signature.slice(0, 20)}…`
  );
}

export function TradingPanel({ token }: TradingPanelProps) {
  const { publicKey, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [inputAmount, setInputAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [showSlippage, setShowSlippage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [solBalance, setSolBalance] = useState(0);
  const [tokenBalance, setTokenBalance] = useState<BN>(new BN(0));

  // ─── Fast Trade Mode (session key) ─────────────────────────────────────────
  const [fastTradeEnabled, setFastTradeEnabled] = useState(false);
  const sessionKpRef = useRef<Keypair | null>(null);
  const [sessionPubkey, setSessionPubkey] = useState<string | null>(null);
  const [sessionSolBal, setSessionSolBal] = useState(0);
  const [sessionTokenBal, setSessionTokenBal] = useState<BN>(new BN(0));
  const [showFastInfo, setShowFastInfo] = useState(false);

  // Load existing session key on mount
  useEffect(() => {
    const key = `fastTrade:${token.mint}`;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      try {
        const { secretKey } = JSON.parse(stored);
        const kp = Keypair.fromSecretKey(new Uint8Array(secretKey));
        sessionKpRef.current = kp;
        setSessionPubkey(kp.publicKey.toBase58());
        setFastTradeEnabled(true);
      } catch {}
    }
  }, [token.mint]);

  // Fetch session key balances — stable callback so socket effect can call it too
  const fetchSessionBalances = useCallback(async () => {
    if (!fastTradeEnabled || !sessionPubkey) return;
    const pk = new PublicKey(sessionPubkey);
    const sol = await connection.getBalance(pk).catch(() => 0);
    setSessionSolBal(sol / 1e9);
    try {
      const ata = getAssociatedTokenAddressSync(new PublicKey(token.mint), pk);
      const acc = await connection.getTokenAccountBalance(ata);
      setSessionTokenBal(new BN(acc.value.amount));
    } catch {
      setSessionTokenBal(new BN(0));
    }
  }, [fastTradeEnabled, sessionPubkey, connection, token.mint]);

  useEffect(() => {
    fetchSessionBalances();
    const id = setInterval(fetchSessionBalances, 8_000);
    return () => clearInterval(id);
  }, [fetchSessionBalances]);

  const toggleFastTrade = useCallback(() => {
    if (fastTradeEnabled) {
      setFastTradeEnabled(false);
      return;
    }
    const key = `fastTrade:${token.mint}`;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      try {
        const { secretKey } = JSON.parse(stored);
        const kp = Keypair.fromSecretKey(new Uint8Array(secretKey));
        sessionKpRef.current = kp;
        setSessionPubkey(kp.publicKey.toBase58());
      } catch {
        const kp = Keypair.generate();
        sessionStorage.setItem(key, JSON.stringify({ secretKey: Array.from(kp.secretKey) }));
        sessionKpRef.current = kp;
        setSessionPubkey(kp.publicKey.toBase58());
      }
    } else {
      const kp = Keypair.generate();
      sessionStorage.setItem(key, JSON.stringify({ secretKey: Array.from(kp.secretKey) }));
      sessionKpRef.current = kp;
      setSessionPubkey(kp.publicKey.toBase58());
    }
    setFastTradeEnabled(true);
    setShowFastInfo(true);
  }, [fastTradeEnabled, token.mint]);

  const revokeSessionKey = useCallback(() => {
    sessionStorage.removeItem(`fastTrade:${token.mint}`);
    sessionKpRef.current = null;
    setSessionPubkey(null);
    setFastTradeEnabled(false);
    setSessionSolBal(0);
    setSessionTokenBal(new BN(0));
  }, [token.mint]);

  // ─── End Fast Trade ─────────────────────────────────────────────────────────

  const virtualSol = new BN(token.virtualSolReserves);
  const virtualTokens = new BN(token.virtualTokenReserves);
  const realTokenReserves = new BN(token.realTokenReserves);
  const realSolReserves = new BN(token.realSolReserves);

  // Fetch per-token portfolio holding (all trades server-side, no pagination gap)
  const { data: tokenPortfolio } = useQuery({
    queryKey: ["portfolio-token", token.mint, publicKey?.toString()],
    queryFn: () => getPortfolio(publicKey!.toString(), token.mint),
    enabled: !!publicKey && tab === "sell" && !fastTradeEnabled,
    staleTime: 10_000, // reduced from 30s — invalidated on new_trade anyway
  });

  // Average buy price in SOL per token — from cost-basis accounting over ALL trades
  const avgBuyPriceSol = useMemo(() => {
    const holding = tokenPortfolio?.holdings?.find((h) => h.mint === token.mint);
    if (!holding || holding.avgBuyPriceSol === 0) return null;
    return holding.avgBuyPriceSol;
  }, [tokenPortfolio, token.mint]);

  // Fetch main wallet balances — stable callback so socket effect can call it too
  const fetchMainBalances = useCallback(async () => {
    if (!publicKey || fastTradeEnabled) return;
    const balance = await connection.getBalance(publicKey);
    setSolBalance(balance / 1e9);
    try {
      const mintPk = new PublicKey(token.mint);
      const ata = getAssociatedTokenAddressSync(mintPk, publicKey);
      const tokenAcct = await connection.getTokenAccountBalance(ata);
      setTokenBalance(new BN(tokenAcct.value.amount));
    } catch {
      setTokenBalance(new BN(0));
    }
  }, [publicKey, connection, token.mint, fastTradeEnabled]);

  useEffect(() => {
    fetchMainBalances();
    const id = setInterval(fetchMainBalances, 8_000); // reduced from 15s
    return () => clearInterval(id);
  }, [fetchMainBalances]);

  // On any trade for this token, immediately refresh balances and portfolio
  // so TradingPanel stays in sync after trades made on another device.
  useEffect(() => {
    if (!socket) return;
    const onNewTrade = (data: any) => {
      if (data.mint !== token.mint) return;
      fetchMainBalances();
      fetchSessionBalances();
      // Portfolio holding / avg-entry-price may have changed — invalidate by prefix
      queryClient.invalidateQueries({ queryKey: ["portfolio-token", token.mint] });
    };
    socket.on("new_trade", onNewTrade);
    return () => { socket.off("new_trade", onNewTrade); };
  }, [socket, token.mint, fetchMainBalances, fetchSessionBalances, queryClient]);

  // Effective balances based on mode
  const effectiveSolBalance = fastTradeEnabled ? sessionSolBal : solBalance;
  const effectiveTokenBalance = fastTradeEnabled ? sessionTokenBal : tokenBalance;

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
    const amount = effectiveTokenBalance.muln(pct).divn(100);
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
    if (msg.includes("Transaction sent but confirmation timed out"))
      return msg; // already user-friendly, includes signature hint
    if (msg.includes("Transaction expired"))
      return "Transaction expired — network was congested. Please try again.";
    if (msg.includes("SlippageExceeded") || msg.includes("6000") || msg.includes("0x1770"))
      return "Slippage exceeded — increase slippage tolerance and retry";
    if (msg.includes("CurveComplete") || msg.includes("AlreadyGraduated") || msg.includes("TokenGraduated") || msg.includes("0x1771") || msg.includes("0x1772"))
      return "Token has graduated — trade on the DEX";
    if (msg.includes("insufficient funds") || msg.includes("Insufficient funds") || msg.includes("0x1"))
      return "Insufficient SOL balance";
    if (msg.includes("InsufficientTokens") || msg.includes("0x1773"))
      return "Insufficient token balance";
    if (msg.includes("Simulation failed:")) {
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
    // In fast trade mode, no wallet needed. Otherwise require wallet.
    if (!fastTradeEnabled && (!publicKey || !anchorWallet)) {
      toast.error("Connect your wallet first");
      return;
    }
    if (fastTradeEnabled && !sessionKpRef.current) {
      toast.error("Fast trade wallet not initialized");
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

    // Hard block: >50% price impact almost guarantees a sandwich attack or a
    // trade that wipes most of the bonding curve. User must split into smaller
    // trades. (Warnings at >2% and >5% are shown in the UI; this is the hard stop.)
    if (calculation.priceImpact > 50) {
      toast.error(
        `Price impact is ${calculation.priceImpact.toFixed(1)}% — reduce the amount and split into smaller trades.`,
        { duration: 5000 },
      );
      return;
    }

    // Pre-flight balance checks
    if (tab === "buy") {
      const solNeeded = parseFloat(inputAmount) * 1.015;
      if (solNeeded > effectiveSolBalance) {
        const walletLabel = fastTradeEnabled ? "fast trade wallet" : "your wallet";
        toast.error(
          effectiveSolBalance < 0.001
            ? `SOL balance is empty — fund the ${walletLabel} to trade`
            : `Insufficient SOL in ${walletLabel} — need ~${solNeeded.toFixed(3)} SOL, have ${effectiveSolBalance.toFixed(3)} SOL`
        );
        return;
      }
    } else {
      const tokenIn = parseTokenAmount(inputAmount);
      if (tokenIn.gt(effectiveTokenBalance)) {
        toast.error(
          effectiveTokenBalance.isZero()
            ? `No ${token.symbol} in ${fastTradeEnabled ? "fast trade wallet" : "your wallet"}`
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
      // Determine signer: session key (fast trade) or connected wallet
      let signerWallet: AnchorWallet;
      const fastKey = fastTradeEnabled ? sessionKpRef.current : null;

      if (fastKey) {
        // Create a mock AnchorWallet backed by the session keypair
        signerWallet = {
          publicKey: fastKey.publicKey,
          signTransaction: async <T extends Transaction | VersionedTransaction>(t: T): Promise<T> => {
            if (t instanceof Transaction) t.partialSign(fastKey);
            return t;
          },
          signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
            txs.forEach((t) => { if (t instanceof Transaction) t.partialSign(fastKey!); });
            return txs;
          },
        };
      } else {
        signerWallet = anchorWallet!;
      }

      let tx;

      if (tab === "buy") {
        const solAmountLamports = parseSolToLamports(inputAmount);
        const buyResult = getBuyAmount(virtualSol, virtualTokens, solAmountLamports, realTokenReserves);
        const minTokensOut = applySlippage(buyResult.tokensOut, slippageBps);

        tx = await buildBuyTransaction({
          connection,
          wallet: signerWallet,
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
          wallet: signerWallet,
          mintAddress: token.mint,
          creatorAddress: token.creator,
          tokenAmountRaw,
          minSolOut,
        });
      }

      // Simulate before sending
      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        const logs = sim.value.logs ?? [];
        const errLine =
          logs.find((l) => l.includes("Program log: Error") || l.includes("AnchorError")) ??
          logs.find((l) => l.includes("Error") || l.includes("failed")) ??
          JSON.stringify(sim.value.err);
        throw new Error(`Simulation failed: ${errLine}`);
      }

      let sig: string;

      if (fastKey) {
        // Fast trade: sign with session key and broadcast directly (no wallet popup)
        tx.sign(fastKey);
        sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
      } else {
        // Normal trade: wallet signs and broadcasts (shows Phantom popup)
        sig = await sendTransaction(tx, connection, { skipPreflight: true });
      }

      // Poll for confirmation via HTTP instead of relying on WebSocket
      // subscriptions (which silently hang on Helius devnet).
      // Polls getSignatureStatus every 1.5s for up to 60s, then does a final
      // check with transaction history search before giving up.
      await pollConfirmation(connection, sig, 60_000);

      // Invalidate trade markers (chart dots) and the trades list (TradesList panel).
      // Do NOT invalidate ohlcv — the indexer emits price_update before its DB
      // writes complete, so an immediate OHLCV refetch returns stale data and
      // wipes the live candle the socket already updated. The 10s refetchInterval
      // in PriceChart handles DB convergence without clobbering the live candle.
      queryClient.invalidateQueries({ queryKey: ["trades-markers", token.mint] });
      queryClient.invalidateQueries({ queryKey: ["trades", token.mint] });

      toast.dismiss(loadingToast);
      toast.success(
        <span>
          {tab === "buy" ? "Bought" : "Sold"} successfully!{" "}
          <a
            href={`https://explorer.solana.com/tx/${sig}${process.env.NEXT_PUBLIC_NETWORK && process.env.NEXT_PUBLIC_NETWORK !== "mainnet-beta" ? `?cluster=${process.env.NEXT_PUBLIC_NETWORK}` : ""}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            View tx
          </a>
        </span>,
        { duration: 6000 }
      );
      setInputAmount("");

      // Refresh balances after trade
      if (fastKey) {
        const sol = await connection.getBalance(fastKey.publicKey).catch(() => 0);
        setSessionSolBal(sol / 1e9);
        try {
          const ata = getAssociatedTokenAddressSync(new PublicKey(token.mint), fastKey.publicKey);
          const acc = await connection.getTokenAccountBalance(ata);
          setSessionTokenBal(new BN(acc.value.amount));
        } catch {
          setSessionTokenBal(new BN(0));
        }
      } else {
        const balance = await connection.getBalance(publicKey!);
        setSolBalance(balance / 1e9);
        try {
          const { PublicKey: PK } = await import("@solana/web3.js");
          const { getAssociatedTokenAddressSync: getAta } = await import("@solana/spl-token");
          const ata = getAta(new PK(token.mint), publicKey!);
          const tokenAcct = await connection.getTokenAccountBalance(ata);
          setTokenBalance(new BN(tokenAcct.value.amount));
        } catch {
          // ATA may not exist yet
        }
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, anchorWallet, fastTradeEnabled, effectiveSolBalance, effectiveTokenBalance, inputAmount, tab, token, slippageBps, sendTransaction, connection, calculation, virtualSol, virtualTokens, realTokenReserves, realSolReserves, solBalance, tokenBalance, queryClient]);

  const mediumImpact = calculation && calculation.priceImpact > 2 && calculation.priceImpact <= 5;
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
            href={`${process.env.NEXT_PUBLIC_NETWORK !== "mainnet" ? "https://devnet.raydium.io" : "https://raydium.io"}/swap/?inputMint=sol&outputMint=${token.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#7c3aed50] bg-[#7c3aed20] py-3 text-sm font-semibold text-[#c4b5fd] transition-colors hover:bg-[#7c3aed35]"
          >
            Trade on Raydium ↗
          </a>
        </div>
      ) : (
      <>
      {/* Buy / Sell tabs + Fast Trade toggle */}
      <div className="flex items-center gap-1 p-1.5">
        <div className="flex flex-1 gap-1">
          <button
            onClick={() => { setTab("buy"); setInputAmount(""); }}
            className={clsx(
              "relative flex-1 rounded-2xl py-2.5 sm:py-3 text-sm font-semibold transition-all",
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
              "relative flex-1 rounded-2xl py-2.5 sm:py-3 text-sm font-semibold transition-all",
              tab === "sell"
                ? "bg-[#ff4444]/10 text-[#ff7b88] shadow-[inset_0_0_0_1px_rgba(255,68,68,0.35),0_0_22px_rgba(255,68,68,0.12)]"
                : "text-white/40 hover:text-white border border-transparent"
            )}
          >
            Sell
          </button>
        </div>
        {/* Fast Trade Toggle */}
        <button
          onClick={toggleFastTrade}
          title={fastTradeEnabled ? "Fast Trade ON — click to disable" : "Enable Fast Trade (no wallet popup)"}
          className={clsx(
            "flex items-center gap-1 rounded-2xl px-2.5 py-2.5 sm:py-3 text-xs font-semibold transition-all border",
            fastTradeEnabled
              ? "bg-[#ffaa00]/15 border-[#ffaa00]/40 text-[#ffaa00] shadow-[0_0_12px_rgba(255,170,0,0.2)]"
              : "border-white/10 text-white/30 hover:text-white/60 hover:border-white/20"
          )}
        >
          ⚡
        </button>
      </div>

      {/* Fast Trade Info Panel */}
      {fastTradeEnabled && sessionPubkey && (
        <div className="mx-3 mb-1 rounded-2xl border border-[#ffaa00]/25 bg-[#ffaa00]/8 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#ffaa00] text-xs font-semibold">⚡ Fast Trade Wallet</span>
            <div className="flex items-center gap-2">
              <span className="text-[#ffaa00] text-xs font-mono">{sessionSolBal.toFixed(4)} SOL</span>
              <button
                onClick={() => setShowFastInfo(!showFastInfo)}
                className="text-[#888] hover:text-white text-xs"
              >
                {showFastInfo ? "▲" : "▼"}
              </button>
            </div>
          </div>

          {showFastInfo && (
            <div className="space-y-2 pt-1 border-t border-[#ffaa00]/15">
              <div className="flex items-center gap-1">
                <span className="text-[#888] text-[10px] font-mono flex-1 truncate">{sessionPubkey}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(sessionPubkey); toast.success("Address copied"); }}
                  className="text-[#888] hover:text-white text-[10px] px-1.5 py-0.5 rounded border border-white/10 hover:border-white/25 flex-shrink-0"
                >
                  Copy
                </button>
              </div>
              {sessionTokenBal.gtn(0) && (
                <div className="text-[#aaa] text-[10px]">{formatTokenAmount(sessionTokenBal)} {token.symbol} in session</div>
              )}
              {sessionSolBal < 0.01 && (
                <div className="text-[#ffcc44] text-[10px]">⚠ Fund this address with SOL to trade without wallet popups</div>
              )}
              <div className="text-[#ffcc44]/70 text-[10px] leading-relaxed">
                ⚠ Security: this key is stored unencrypted in your browser session. Keep the balance small (under 0.5 SOL). Any script running on this page could read it.
              </div>
              <div className="text-[#555] text-[10px]">Session key is stored locally in this browser tab only. Tokens go to this address — send back to your main wallet when done.</div>
              <button
                onClick={revokeSessionKey}
                className="text-[#ff4444]/60 hover:text-[#ff4444] text-[10px] underline"
              >
                Revoke session key
              </button>
            </div>
          )}

          {!showFastInfo && sessionSolBal < 0.01 && (
            <div className="text-[#ffcc44] text-[10px]">⚠ Fund {sessionPubkey.slice(0, 8)}…{sessionPubkey.slice(-4)} with SOL</div>
          )}
        </div>
      )}

      <div className="space-y-3 sm:space-y-4 p-3 sm:p-4">
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

        {tab === "sell" && effectiveTokenBalance.gtn(0) && (
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
                ? `${effectiveSolBalance.toFixed(3)} SOL`
                : `${formatTokenAmount(effectiveTokenBalance)} ${token.symbol}`}
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
            <div className="space-y-2 rounded-[20px] border border-white/8 bg-white/[0.04] p-2.5 sm:p-3">
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
                  <span className="text-white/42">Est. Realized PnL</span>
                  <span className={clsx("font-mono font-semibold", pnlSol >= 0 ? "text-[#00ff88]" : "text-[#ff4444]")}>
                    {pnlSol >= 0 ? "+" : ""}{pnlSol.toFixed(4)} SOL
                    {pnlPct !== null && ` (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%)`}
                  </span>
                </div>
              )}
              {tab === "sell" && avgBuyPriceSol !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Avg Entry</span>
                  <span className="font-mono text-white/30">{fmtTokenPrice(avgBuyPriceSol)} SOL/token</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Price impact warnings */}
        {highImpact && (
          <div className="rounded-[20px] border border-[#ff444430] bg-[#ff444415] p-2.5 sm:p-3 text-xs text-[#ff7b88]">
            🚨 Very high price impact ({calculation!.priceImpact.toFixed(1)}%). You may be sandwiched by bots. Split into smaller trades.
          </div>
        )}
        {mediumImpact && (
          <div className="rounded-[20px] border border-[#ffcf5a30] bg-[#ffcf5a10] p-2.5 sm:p-3 text-xs text-[#ffcf5a]">
            ⚠️ Price impact {calculation!.priceImpact.toFixed(1)}% — bots may front-run this trade.
          </div>
        )}

        {/* Insufficient balance warning */}
        {(fastTradeEnabled ? true : !!publicKey) && inputAmount && parseFloat(inputAmount) > 0 && (
          tab === "buy" && parseFloat(inputAmount) * 1.015 > effectiveSolBalance ? (
            <div className="rounded-[20px] border border-[#ff444430] bg-[#ff444415] p-2.5 sm:p-3 text-xs text-[#ff7b88]">
              {effectiveSolBalance < 0.001
                ? `${fastTradeEnabled ? "Fast trade wallet" : "Your wallet"} has no SOL.`
                : `Insufficient SOL — need ~${(parseFloat(inputAmount) * 1.015).toFixed(3)} SOL, have ${effectiveSolBalance.toFixed(3)} SOL.`}
            </div>
          ) : tab === "sell" && parseTokenAmount(inputAmount).gt(effectiveTokenBalance) ? (
            <div className="rounded-[20px] border border-[#ff444430] bg-[#ff444415] p-2.5 sm:p-3 text-xs text-[#ff7b88]">
              {effectiveTokenBalance.isZero()
                ? `No ${token.symbol} in ${fastTradeEnabled ? "fast trade wallet" : "your wallet"}.`
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
          disabled={isLoading || (!fastTradeEnabled && !publicKey) || !inputAmount || parseFloat(inputAmount) <= 0 || token.isGraduated}
          className={clsx(
            "w-full rounded-2xl py-3 sm:py-3.5 text-sm font-bold transition-all",
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
          ) : fastTradeEnabled ? (
            tab === "buy" ? `⚡ Buy ${token.symbol}` : `⚡ Sell ${token.symbol}`
          ) : !publicKey ? (
            "Connect Wallet"
          ) : tab === "buy" ? (
            `Buy ${token.symbol}`
          ) : (
            `Sell ${token.symbol}`
          )}
        </button>
        {tab === "buy" && !token.isGraduated && (
          <BuyCurveHint />
        )}
      </div>
      </>
      )}
    </div>
  );
}
