"use client";

import React, { useState, useCallback } from "react";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { createTokenRecord } from "@/lib/api";
import { buildCreateTokenTransaction } from "@/lib/program";

// Minimum SOL needed to create a token (rent for mint + bonding curve + 4 vaults)
const CREATE_TOKEN_MIN_SOL = 0.015;

function friendlyLaunchError(raw: string): string {
  if (raw.includes("0x1") || raw.includes("custom program error: 0x1") || raw.includes("insufficient funds") || raw.includes("Insufficient"))
    return `Insufficient SOL balance — you need at least ${CREATE_TOKEN_MIN_SOL} SOL to create a token. Get free devnet SOL at faucet.solana.com`;
  if (raw.includes("User rejected") || raw.includes("rejected the request"))
    return "Transaction cancelled.";
  if (raw.includes("NetworkError") || raw.includes("Failed to fetch") || raw.includes("fetch"))
    return "Cannot reach Solana network. Check your connection and try again.";
  if (raw.includes("InvalidMetadata"))
    return "Invalid token name, symbol or image URL. Name must be 1–32 chars, symbol 1–10 chars.";
  if (raw.includes("Simulation failed"))
    return raw.replace("Simulation failed: ", "Launch failed: ");
  if (raw.includes("BlockhashNotFound") || raw.includes("blockhash"))
    return "Transaction expired — please try again.";
  return raw.length > 150 ? raw.slice(0, 150) + "…" : raw;
}

type Step = 1 | 2 | 3;

interface FormData {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
}

const INITIAL_FORM: FormData = {
  name: "",
  symbol: "",
  description: "",
  imageUrl: "",
  websiteUrl: "",
  twitterUrl: "",
  telegramUrl: "",
};

interface LaunchFormProps {
  onSuccess?: (mint: string) => void;
}

export function LaunchForm({ onSuccess }: LaunchFormProps) {
  const { publicKey, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLaunching, setIsLaunching] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [launchedMint, setLaunchedMint] = useState<string | null>(null);

  const update = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep1 = () => {
    if (!form.name.trim()) return "Token name is required";
    if (form.name.length > 32) return "Name must be 32 characters or less";
    if (!form.symbol.trim()) return "Token symbol is required";
    if (form.symbol.length > 10) return "Symbol must be 10 characters or less";
    if (!form.description.trim()) return "Description is required";
    return null;
  };

  const handleNextStep = () => {
    if (step === 1) {
      const err = validateStep1();
      if (err) { toast.error(err); return; }
    }
    setStep((s) => (Math.min(3, s + 1) as Step));
  };

  const handleLaunch = useCallback(async () => {
    if (!publicKey || !anchorWallet) {
      toast.error("Connect your wallet to launch a token");
      return;
    }

    const err = validateStep1();
    if (err) { toast.error(err); return; }

    setIsLaunching(true);
    const loadingToast = toast.loading("Preparing transaction...");

    try {
      // Pre-flight: check wallet has enough SOL for rent + fees
      const balance = await connection.getBalance(publicKey);
      if (balance / 1e9 < CREATE_TOKEN_MIN_SOL) {
        throw new Error(`insufficient funds — need ${CREATE_TOKEN_MIN_SOL} SOL, have ${(balance / 1e9).toFixed(4)} SOL`);
      }

      const name = form.name.trim();
      const symbol = form.symbol.trim().toUpperCase();

      // URI: use image URL if provided, otherwise empty string
      // In production this would be an Arweave/IPFS metadata JSON URL
      const uri = form.imageUrl.trim() || "";

      // Build the on-chain createToken transaction
      toast.loading("Sending transaction...", { id: loadingToast });
      const { transaction, mintKeypair } = await buildCreateTokenTransaction({
        connection,
        wallet: anchorWallet,
        name,
        symbol,
        uri,
      });

      // Simulate first to surface program errors (skip if RPC unreachable)
      try {
        const sim = await connection.simulateTransaction(transaction);
        if (sim.value.err) {
          const errLine = sim.value.logs?.find((l) => l.includes("Error") || l.includes("failed"));
          throw new Error(`Simulation failed: ${errLine ?? JSON.stringify(sim.value.err)}`);
        }
      } catch (simErr: any) {
        // Only re-throw if it's a program error, not a network error
        if (simErr.message?.startsWith("Simulation failed:")) throw simErr;
        console.warn("Simulation skipped (network issue):", simErr.message);
      }

      const sig = await sendTransaction(transaction, connection, {
        signers: [mintKeypair],
        skipPreflight: false,
      });

      toast.loading("Confirming...", { id: loadingToast });
      // Confirmation is best-effort — tx is already submitted to the network
      try {
        await connection.confirmTransaction(sig, "confirmed");
      } catch (confirmErr: any) {
        const msg: string = confirmErr?.message ?? "";
        if (msg.includes("NetworkError") || msg.includes("Failed to fetch") || msg.includes("fetch")) {
          console.warn("Confirmation polling failed, tx already sent:", sig);
          // Continue — transaction is live on-chain
        } else {
          throw confirmErr;
        }
      }

      const mint = mintKeypair.publicKey.toString();

      // Register in backend DB (best-effort — token is already live on-chain)
      try {
        await createTokenRecord({
          mint,
          name,
          symbol,
          description: form.description.trim(),
          imageUrl: form.imageUrl || undefined,
          websiteUrl: form.websiteUrl || undefined,
          twitterUrl: form.twitterUrl || undefined,
          telegramUrl: form.telegramUrl || undefined,
          creator: publicKey.toString(),
        });
      } catch (backendErr) {
        // Backend unavailable — token is still live on-chain, indexer will catch it
        console.warn("Backend registration failed (indexer will sync):", backendErr);
      }

      toast.dismiss(loadingToast);
      setForm(INITIAL_FORM);
      setStep(1);
      setLaunchedMint(mint);
      onSuccess?.(mint);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error("Launch error:", error);
      const rawMsg: string = error?.error?.message ?? error?.message ?? "Failed to launch token";
      toast.error(friendlyLaunchError(rawMsg));
    } finally {
      setIsLaunching(false);
    }
  }, [publicKey, anchorWallet, connection, sendTransaction, form, onSuccess]);

  const stepLabels = ["Details", "Media & Links", "Review & Launch"];

  if (launchedMint) {
    return (
      <div className="text-center space-y-6 py-6">
        <div className="text-5xl">🎉</div>
        <div>
          <div className="text-white text-xl font-bold mb-2">Token Launched!</div>
          <div className="text-[#555] text-sm">Your token is live on Solana devnet</div>
        </div>
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4 text-left">
          <div className="text-[#555] text-xs mb-1">MINT ADDRESS</div>
          <div className="text-[#888] font-mono text-xs break-all">{launchedMint}</div>
        </div>
        <div className="flex flex-col gap-3">
          <a
            href={`/token/${launchedMint}`}
            className="btn-primary text-center"
          >
            View Token →
          </a>
          <button
            onClick={() => setLaunchedMint(null)}
            className="btn-secondary"
          >
            Launch Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {stepLabels.map((label, i) => {
          const s = (i + 1) as Step;
          return (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    step > s
                      ? "bg-[#00ff88] text-black"
                      : step === s
                      ? "bg-[#00ff8830] text-[#00ff88] border border-[#00ff88]"
                      : "bg-[#1a1a1a] text-[#555] border border-[#2a2a2a]"
                  )}
                >
                  {step > s ? "✓" : s}
                </div>
                <span
                  className={clsx(
                    "text-xs font-medium hidden sm:block",
                    step === s ? "text-white" : "text-[#555]"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className="flex-1 h-px bg-[#1a1a1a]" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: Token Details */}
      {step === 1 && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-sm font-medium text-[#888] mb-2">
              Token Name <span className="text-[#ff4444]">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Dogwifhat"
              maxLength={32}
              className="input-field"
            />
            <div className="text-[#444] text-xs mt-1 text-right">{form.name.length}/32</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#888] mb-2">
              Symbol <span className="text-[#ff4444]">*</span>
            </label>
            <input
              type="text"
              value={form.symbol}
              onChange={(e) => update("symbol", e.target.value.toUpperCase())}
              placeholder="e.g. WIF"
              maxLength={10}
              className="input-field"
            />
            <div className="text-[#444] text-xs mt-1 text-right">{form.symbol.length}/10</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#888] mb-2">
              Description <span className="text-[#ff4444]">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Describe your token..."
              maxLength={500}
              rows={4}
              className="input-field resize-none"
            />
            <div className="text-[#444] text-xs mt-1 text-right">{form.description.length}/500</div>
          </div>

          {/* Token info preview */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
            <div className="text-[#555] text-xs mb-3">Token Properties</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[#444] mb-1">Total Supply</div>
                <div className="text-white font-mono">1,000,000,000</div>
              </div>
              <div>
                <div className="text-[#444] mb-1">Decimals</div>
                <div className="text-white font-mono">6</div>
              </div>
              <div>
                <div className="text-[#444] mb-1">Initial Price</div>
                <div className="text-white font-mono">~0.000028 SOL</div>
              </div>
              <div>
                <div className="text-[#444] mb-1">Graduation at</div>
                <div className="text-white font-mono">85 SOL</div>
              </div>
            </div>
          </div>

          {/* Graduation reward preview */}
          <div className="bg-[#00ff8808] border border-[#00ff8820] rounded-xl p-4">
            <div className="text-[#00ff88] text-xs font-semibold mb-2">🎓 Graduation Rewards (at 85 SOL)</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#666]">Your reward (5%)</span>
                <span className="text-[#00ff88] font-mono font-semibold">~4.25 SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Platform cut (5%)</span>
                <span className="text-white font-mono">~4.25 SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">DEX liquidity (90%)</span>
                <span className="text-white font-mono">~76.5 SOL</span>
              </div>
              <div className="pt-1.5 mt-1 border-t border-[#00ff8820] text-[#555]">
                Plus ongoing 1% trading fee: 40% to you, 40% to platform, 20% buyback-and-burn
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Media & Links */}
      {step === 2 && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-sm font-medium text-[#888] mb-2">
              Token Image URL
            </label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => {
                update("imageUrl", e.target.value);
                setImagePreview(e.target.value);
              }}
              placeholder="https://arweave.net/your-image"
              className="input-field"
            />
            {imagePreview && (
              <div className="mt-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-16 h-16 rounded-xl object-cover border border-[#2a2a2a]"
                  onError={() => setImagePreview(null)}
                />
                <span className="text-[#555] text-xs">Image preview</span>
              </div>
            )}
            <div className="text-[#444] text-xs mt-1">
              Upload your image to Arweave or IPFS first, then paste the URL here.
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#888] mb-2">
              Website
            </label>
            <input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => update("websiteUrl", e.target.value)}
              placeholder="https://yourtoken.com"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#888] mb-2">
              Twitter / X
            </label>
            <input
              type="url"
              value={form.twitterUrl}
              onChange={(e) => update("twitterUrl", e.target.value)}
              placeholder="https://twitter.com/yourtoken"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#888] mb-2">
              Telegram
            </label>
            <input
              type="url"
              value={form.telegramUrl}
              onChange={(e) => update("telegramUrl", e.target.value)}
              placeholder="https://t.me/yourtoken"
              className="input-field"
            />
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-5">
            <div className="flex items-start gap-4">
              {form.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.imageUrl}
                  alt={form.name}
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-[#00ff88] flex items-center justify-center text-black font-bold text-xl shrink-0">
                  {form.symbol.slice(0, 2) || "?"}
                </div>
              )}
              <div>
                <div className="text-white font-semibold text-lg">{form.name || "—"}</div>
                <div className="text-[#555] text-sm font-mono">${form.symbol || "—"}</div>
                <div className="text-[#666] text-xs mt-2 line-clamp-2">{form.description}</div>
              </div>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4 space-y-2">
            <div className="text-[#555] text-xs font-medium mb-3">LAUNCH COST ESTIMATE</div>
            {[
              ["Create mint account", "~0.002 SOL"],
              ["Initialize bonding curve", "~0.003 SOL"],
              ["Create token vaults (trading + reserve)", "~0.004 SOL"],
              ["Create fee vaults (buyback + creator)", "~0.002 SOL"],
              ["Mint tokens to bonding curve", "~0.001 SOL"],
            ].map(([label, cost]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-[#666]">{label}</span>
                <span className="text-white font-mono">{cost}</span>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t border-[#1a1a1a] flex justify-between text-sm font-semibold">
              <span className="text-white">Total</span>
              <span className="text-[#00ff88] font-mono">~0.012 SOL</span>
            </div>
          </div>

          {/* Anti-rug info */}
          <div className="bg-[#00ff8808] border border-[#00ff8820] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🛡️</span>
              <div>
                <div className="text-[#00ff88] text-sm font-semibold mb-1">
                  Anti-Rug Protection
                </div>
                <ul className="text-[#666] text-xs space-y-1">
                  <li>• Tokens are minted to the bonding curve vault</li>
                  <li>• Creator cannot withdraw SOL from the curve</li>
                  <li>• Bonding curve is immutable once deployed</li>
                  <li>• Liquidity is locked at graduation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-8">
        {step > 1 && (
          <button
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="btn-secondary flex-1"
          >
            Back
          </button>
        )}
        {step < 3 ? (
          <button onClick={handleNextStep} className="btn-primary flex-1">
            Continue →
          </button>
        ) : (
          <button
            onClick={handleLaunch}
            disabled={isLaunching || !publicKey}
            className="btn-primary flex-1"
          >
            {isLaunching ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Launching...
              </span>
            ) : !publicKey ? (
              "Connect Wallet First"
            ) : (
              "🚀 Launch Token"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
