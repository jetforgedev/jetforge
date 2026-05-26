"use client";

import React, { useState, useCallback, useRef } from "react";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { createTokenRecord, uploadImage, uploadTokenAssets } from "@/lib/api";
import { buildCreateTokenTransaction, grindVanityKeypairAsync } from "@/lib/program";

// Minimum SOL needed to create a token (rent for mint + bonding curve + 4 vaults)
const CREATE_TOKEN_MIN_SOL = 0.015;

function friendlyLaunchError(raw: string): string {
  if (raw.includes("0x1") || raw.includes("custom program error: 0x1") || raw.includes("insufficient funds") || raw.includes("Insufficient"))
    return `Insufficient SOL balance — you need at least ${CREATE_TOKEN_MIN_SOL} SOL to create a token.${process.env.NEXT_PUBLIC_NETWORK === "devnet" ? " Get free devnet SOL at faucet.solana.com" : ""}`;
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

// Phases shown in the full-screen launch overlay
type LaunchPhase =
  | "idle"
  | "uploading"    // uploading image + metadata to Arweave
  | "forging"      // grinding vanity keypair ending in "jet"
  | "signing"      // waiting for wallet approval
  | "confirming"   // waiting for on-chain confirmation
  | "done";

// ─── Launch Overlay ───────────────────────────────────────────────────────────
function LaunchOverlay({
  phase,
  grindAttempts,
}: {
  phase: LaunchPhase;
  grindAttempts: number;
}) {
  if (phase === "idle" || phase === "done") return null;

  const steps: { id: LaunchPhase; label: string; sublabel: string }[] = [
    { id: "uploading",  label: "Uploading to Arweave",  sublabel: "Saving image & metadata permanently" },
    { id: "forging",    label: "Forging address",        sublabel: "" },
    { id: "signing",    label: "Wallet approval",        sublabel: "Sign the transaction in your wallet" },
    { id: "confirming", label: "Confirming on-chain",    sublabel: "Waiting for Solana to confirm" },
  ];

  const phaseOrder: LaunchPhase[] = ["uploading", "forging", "signing", "confirming"];
  const currentIdx = phaseOrder.indexOf(phase);
  const progress = currentIdx < 0 ? 0 : Math.round(((currentIdx + 0.6) / phaseOrder.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-[32px] border border-[#00ff88]/20 bg-[#0a0a0a] p-7 shadow-[0_0_80px_rgba(0,255,136,0.12)]">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#00ff88]/30 bg-[#00ff88]/10 text-3xl animate-bounce">
            🚀
          </div>
        </div>

        <h2 className="mb-1 text-center text-lg font-bold text-white">Launching Token</h2>
        <p className="mb-6 text-center text-xs text-white/40">Do not close this window</p>

        <div className="mb-6 space-y-3">
          {steps.map((s, i) => {
            const isDone   = i < currentIdx;
            const isActive = s.id === phase;
            return (
              <div key={s.id} className="flex items-start gap-3">
                <div className={clsx(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                  isDone
                    ? "bg-[#00ff88] text-black"
                    : isActive
                    ? "border border-[#00ff88] bg-[#00ff88]/15 text-[#00ff88]"
                    : "border border-white/10 bg-white/[0.04] text-white/25"
                )}>
                  {isDone ? "✓" : isActive ? (
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (i + 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={clsx(
                    "text-sm font-semibold",
                    isDone ? "text-[#00ff88]" : isActive ? "text-white" : "text-white/30"
                  )}>
                    {s.label}
                  </div>
                  {isActive && (
                    <div className="mt-0.5 text-xs text-white/40 truncate">
                      {s.id === "forging"
                        ? `Finding a mint ending in "jet" · ${grindAttempts.toLocaleString()} attempts`
                        : s.sublabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[#00ff88] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

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
  const [isUploading, setIsUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [launchedMint, setLaunchedMint] = useState<string | null>(null);
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("idle");
  const [grindAttempts, setGrindAttempts] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPEG, PNG, GIF, WebP)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image is too large — please use an image under 4 MB.");
      return;
    }
    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);

    setImageFile(file);
    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      update("imageUrl", url);
      setImagePreview(url);
      toast.success("Image ready!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
      setImagePreview(null);
      update("imageUrl", "");
    } finally {
      setIsUploading(false);
    }
  }, []);

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
    setLaunchPhase("idle");
    setGrindAttempts(0);
    const loadingToast = toast.loading("Preparing transaction...");

    try {
      // Pre-flight: check wallet has enough SOL for rent + fees
      const balance = await connection.getBalance(publicKey);
      if (balance / 1e9 < CREATE_TOKEN_MIN_SOL) {
        throw new Error(`insufficient funds — need ${CREATE_TOKEN_MIN_SOL} SOL, have ${(balance / 1e9).toFixed(4)} SOL`);
      }

      const name = form.name.trim();
      const symbol = form.symbol.trim().toUpperCase();

      // ── Phase 1: Upload image + metadata to Arweave ──────────────────────────
      setLaunchPhase("uploading");
      toast.loading("Uploading to Arweave...", { id: loadingToast });
      const { imageUrl: localImageUrl, arweaveImageUrl, metadataUri } = await uploadTokenAssets(
        imageFile,
        {
          name,
          symbol,
          description: form.description.trim(),
          creator: publicKey.toString(),
          websiteUrl:  form.websiteUrl  || undefined,
          twitterUrl:  form.twitterUrl  || undefined,
          telegramUrl: form.telegramUrl || undefined,
        }
      );
      // Use local URL for immediate display; arweave URL is embedded in metadataUri on-chain
      const displayImageUrl = localImageUrl || arweaveImageUrl;
      const uri = metadataUri;
      console.log("[LaunchForm] local imageUrl:", localImageUrl);
      console.log("[LaunchForm] Arweave metadataUri:", uri);

      // ── Phase 2: Forge vanity mint address ending in "jet" ────────────────────
      setLaunchPhase("forging");
      toast.loading("Forging vanity address...jet ✨", { id: loadingToast });
      const mintKeypairForUri = await grindVanityKeypairAsync("jet", (attempts) => {
        setGrindAttempts(attempts);
      });
      console.log("[LaunchForm] Vanity mint:", mintKeypairForUri.publicKey.toBase58());

      // ── Phase 3: Wallet signing ───────────────────────────────────────────────
      setLaunchPhase("signing");
      toast.loading("Waiting for wallet approval...", { id: loadingToast });
      const { transaction, mintKeypair } = await buildCreateTokenTransaction({
        connection,
        wallet: anchorWallet,
        name,
        symbol,
        uri,
        mintKeypair: mintKeypairForUri,
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

      // ── Phase 4: On-chain confirmation ────────────────────────────────────────
      setLaunchPhase("confirming");
      toast.loading("Confirming on-chain...", { id: loadingToast });
      // Confirmation is best-effort — tx is already broadcast to the network.
      // ALL polling failures (including TransactionExpiredTimeoutError) are
      // swallowed silently; the transaction is live on-chain regardless.
      try {
        await connection.confirmTransaction(sig, "confirmed");
      } catch (confirmErr: any) {
        const msg: string = confirmErr?.message ?? "";
        console.warn("[LaunchForm] Confirmation polling failed (tx already sent):", msg.slice(0, 80), "sig:", sig);
        // Continue — transaction is live on-chain
      }

      const mint = mintKeypair.publicKey.toString();

      // Post-launch: save token record with permanent Arweave URLs.
      try {
        await createTokenRecord({
          mint,
          name,
          symbol,
          description: form.description.trim(),
          imageUrl:    displayImageUrl  || undefined,
          metadataUri: metadataUri     || undefined,
          websiteUrl:  form.websiteUrl  || undefined,
          twitterUrl:  form.twitterUrl  || undefined,
          telegramUrl: form.telegramUrl || undefined,
          creator: publicKey.toString(),
        });
      } catch (metaErr) {
        console.warn("[LaunchForm] Post-launch record save failed:", metaErr);
      }

      setLaunchPhase("done");
      toast.dismiss(loadingToast);
      setForm(INITIAL_FORM);
      setImageFile(null);
      setImagePreview(null);
      setStep(1);
      setLaunchedMint(mint);
      onSuccess?.(mint);
    } catch (error: any) {
      setLaunchPhase("idle");
      toast.dismiss(loadingToast);
      console.error("Launch error:", error);
      const rawMsg: string = error?.error?.message ?? error?.message ?? "Failed to launch token";
      toast.error(friendlyLaunchError(rawMsg));
    } finally {
      setIsLaunching(false);
    }
  }, [publicKey, anchorWallet, connection, sendTransaction, form, imageFile, onSuccess]);

  const stepLabels = ["Details", "Media & Links", "Review & Launch"];

  if (launchedMint) {
    return (
      <div className="text-center space-y-6 py-6">
        <div className="text-5xl">🎉</div>
        <div>
          <div className="text-white text-xl font-bold mb-2">Token Launched!</div>
          <div className="text-[#555] text-sm">Your token is live on Solana {process.env.NEXT_PUBLIC_NETWORK || "devnet"}</div>
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
    <>
      <LaunchOverlay phase={launchPhase} grindAttempts={grindAttempts} />
      <div className="mx-auto max-w-xl">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {stepLabels.map((label, i) => {
          const s = (i + 1) as Step;
          return (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all",
                    step > s
                      ? "bg-[#00ff88] text-black shadow-[0_0_26px_rgba(0,255,136,0.3)]"
                      : step === s
                      ? "border border-[#00ff88]/55 bg-[#00ff88]/15 text-[#00ff88] shadow-[0_0_30px_rgba(0,255,136,0.18)]"
                      : "border border-white/10 bg-white/[0.04] text-white/35"
                  )}
                >
                  {step > s ? "✓" : s}
                </div>
                <span
                  className={clsx(
                    "hidden text-xs font-semibold sm:block",
                    step === s ? "text-white" : "text-white/35"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className={clsx("h-px flex-1", step > s ? "bg-[#00ff88]/35" : "bg-white/8")} />
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
          <div className="glass-panel rounded-[24px] p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">Token Properties</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="mb-1 text-white/35">Total Supply</div>
                <div className="text-white font-mono">1,000,000,000</div>
              </div>
              <div>
                <div className="mb-1 text-white/35">Decimals</div>
                <div className="text-white font-mono">6</div>
              </div>
              <div>
                <div className="mb-1 text-white/35">Initial Price</div>
                <div className="text-white font-mono">~0.000028 SOL</div>
              </div>
              <div>
                <div className="mb-1 text-white/35">Graduation at</div>
                <div className="text-white font-mono">85 SOL</div>
              </div>
            </div>
          </div>

          {/* Graduation reward preview */}
          <div className="rounded-[24px] border border-[#00ff88]/18 bg-[linear-gradient(135deg,rgba(0,255,136,0.10),rgba(0,255,136,0.03))] p-4">
            <div className="text-[#00ff88] text-xs font-semibold mb-2">🎓 Graduation Rewards (at 85 SOL)</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-white/50">Your reward (5%)</span>
                <span className="text-[#00ff88] font-mono font-semibold">~4.25 SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Platform cut (5%)</span>
                <span className="text-white font-mono">~4.25 SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">DEX liquidity (90%)</span>
                <span className="text-white font-mono">~76.5 SOL</span>
              </div>
              <div className="mt-1 border-t border-[#00ff88]/18 pt-1.5 text-white/42">
                Plus ongoing 1% trading fee: 40% to you, 40% to platform, 20% buyback-and-burn
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Media & Links */}
      {step === 2 && (
        <div className="space-y-5 animate-fade-in">
          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-[#888] mb-2">
              Token Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
              }}
            />

            {/* Drop zone / preview */}
            {imagePreview ? (
              <div className="glass-panel flex items-center gap-4 rounded-[24px] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-20 w-20 shrink-0 rounded-2xl border border-white/10 object-cover"
                  onError={() => setImagePreview(null)}
                />
                <div className="flex-1 min-w-0">
                  {isUploading ? (
                    <div className="flex items-center gap-2 text-[#00ff88] text-sm">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Uploading...
                    </div>
                  ) : (
                    <div className="text-[#00ff88] text-sm font-medium">✓ Image ready — uploads to Arweave on launch</div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                      update("imageUrl", "");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="mt-1 text-xs text-white/40 transition-colors hover:text-[#ff5b6e]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleImageFile(file);
                }}
                className={clsx(
                  "cursor-pointer rounded-[24px] border-2 border-dashed p-8 text-center transition-all",
                  isDragging
                    ? "border-[#00ff88] bg-[#00ff88]/10 shadow-[0_0_30px_rgba(0,255,136,0.12)]"
                    : "border-white/12 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                )}
              >
                <div className="text-3xl mb-2">🖼️</div>
                <div className="text-white text-sm font-medium mb-1">
                  Drop image here or click to browse
                </div>
                <div className="text-[#555] text-xs">
                  JPEG, PNG, GIF, WebP — max 5 MB
                </div>
              </div>
            )}
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
          <div className="glass-panel rounded-[24px] p-5">
            <div className="flex items-start gap-4">
              {form.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.imageUrl}
                  alt={form.name}
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#00ff88] text-xl font-bold text-black">
                  {form.symbol.slice(0, 2) || "?"}
                </div>
              )}
              <div>
                <div className="text-white font-semibold text-lg">{form.name || "—"}</div>
                <div className="text-[#555] text-sm font-mono">${form.symbol || "—"}</div>
                <div className="mt-2 line-clamp-2 text-xs text-white/52">{form.description}</div>
              </div>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="glass-panel rounded-[24px] p-4 space-y-2">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">LAUNCH COST ESTIMATE</div>
            {[
              ["Create mint account", "~0.002 SOL"],
              ["Initialize bonding curve", "~0.003 SOL"],
              ["Create token vaults (trading + reserve)", "~0.004 SOL"],
              ["Create fee vaults (buyback + creator)", "~0.002 SOL"],
              ["Mint tokens to bonding curve", "~0.001 SOL"],
            ].map(([label, cost]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-white/50">{label}</span>
                <span className="text-white font-mono">{cost}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-white/8 pt-2 text-sm font-semibold">
              <span className="text-white">Total</span>
              <span className="text-[#00ff88] font-mono">~0.012 SOL</span>
            </div>
          </div>

          {/* Anti-rug info */}
          <div className="rounded-[24px] border border-[#00ff88]/18 bg-[linear-gradient(135deg,rgba(0,255,136,0.10),rgba(0,255,136,0.03))] p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">🛡️</span>
              <div>
                <div className="text-[#00ff88] text-sm font-semibold mb-1">
                  Anti-Rug Protection
                </div>
                <ul className="space-y-1 text-xs text-white/50">
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
      <div className="mt-8 flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="btn-secondary flex-1"
          >
            Back
          </button>
        )}
        {step < 3 ? (
          <button onClick={handleNextStep} className="btn-primary animate-gradient-shift flex-1 py-4 text-base">
            Continue →
          </button>
        ) : (
          <button
            onClick={handleLaunch}
            disabled={isLaunching || !publicKey}
            className="btn-primary animate-gradient-shift flex-1 py-4 text-base shadow-[0_18px_40px_rgba(0,255,136,0.24)]"
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
    </>
  );
}
