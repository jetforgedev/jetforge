"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { clsx } from "clsx";
import { TokenData, truncateAddress, timeAgo } from "@/lib/api";
import { formatSol } from "@/lib/bondingCurve";
import BN from "bn.js";

interface TokenCardProps {
  token: TokenData;
  isWatched?: boolean;
  onWatchToggle?: () => void;
}

function TokenAvatar({ name, imageUrl, mint }: { name: string; imageUrl?: string; mint: string }) {
  const [imgError, setImgError] = React.useState(false);

  if (imageUrl && !imgError) {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover"
          onError={() => setImgError(true)}
          unoptimized
        />
      </div>
    );
  }

  const colors = ["#00ff88", "#7c3aed", "#ef4444", "#f59e0b", "#3b82f6", "#ec4899"];
  const color = colors[parseInt(mint.slice(0, 8), 16) % colors.length];
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-black shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
      style={{ background: color }}
    >
      {initials}
    </div>
  );
}

function computeRugScore(token: TokenData): { score: number; label: string; color: string; bg: string; border: string } {
  let risk = 0;

  const ageMs = Date.now() - new Date(token.createdAt).getTime();
  const ageHours = ageMs / 3_600_000;

  if (ageHours < 1) risk += 20;
  else if (ageHours < 24) risk += 10;

  if (token.trades < 5) risk += 25;
  else if (token.trades < 20) risk += 10;

  if (token.volume24h < 0.01) risk += 20;
  else if (token.volume24h < 0.1) risk += 10;

  if (token.holders < 3) risk += 20;
  else if (token.holders < 10) risk += 10;

  if (token.graduationProgress > 60) risk -= 15;
  else if (token.graduationProgress > 30) risk -= 5;

  if (token.isGraduated) risk -= 20;

  risk = Math.max(0, Math.min(100, risk));

  if (risk <= 25) return { score: risk, label: "Low Risk", color: "#00ff88", bg: "#00ff8810", border: "#00ff8830" };
  if (risk <= 55) return { score: risk, label: "Medium Risk", color: "#ffaa00", bg: "#ffaa0015", border: "#ffaa0030" };
  return { score: risk, label: "High Risk", color: "#ff4444", bg: "#ff444415", border: "#ff444430" };
}

function isTrending(token: TokenData): boolean {
  const ageHours = (Date.now() - new Date(token.createdAt).getTime()) / 3_600_000;
  return token.volume24h >= 0.5 || (token.trades >= 15 && ageHours < 48);
}

export function TokenCard({ token, isWatched = false, onWatchToggle }: TokenCardProps) {
  const graduationPct = Math.min(100, token.graduationProgress || 0);
  const isNearGrad = graduationPct >= 80;
  const rug = computeRugScore(token);
  const trending = isTrending(token);

  return (
    <div className="relative">
      {onWatchToggle && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onWatchToggle();
          }}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/25 px-2.5 py-1.5 text-sm leading-none text-white/70 backdrop-blur-sm transition-all hover:scale-110 hover:text-white"
          title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
        >
          {isWatched ? "⭐" : "☆"}
        </button>
      )}

      <Link href={`/token/${token.mint}`}>
        <div
          className={clsx(
            "token-card relative overflow-hidden rounded-[26px] border bg-white/[0.03] p-4 backdrop-blur-sm",
            "border-white/[0.08] shadow-[0_18px_40px_rgba(0,0,0,0.18)]",
            trending && "before:absolute before:inset-0 before:rounded-[26px] before:border before:border-[#00ff88]/25 before:content-[''] before:animate-shimmer",
            isNearGrad && "animate-glow-pulse border-[#ffcf5a]/35"
          )}
        >
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_70%)]" />

          <div className="relative mb-4 flex items-start gap-3">
            <TokenAvatar name={token.name} imageUrl={token.imageUrl} mint={token.mint} />
            <div className="min-w-0 flex-1 pr-8">
              <div className="mb-1 flex items-center gap-2">
                <span className="truncate text-base font-bold tracking-tight text-white">{token.name}</span>
                <span className="shrink-0 text-xs font-mono text-white/38">{token.symbol}</span>
              </div>
              <div className="truncate text-xs text-white/45">by {truncateAddress(token.creator)}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {trending && (
                  <span className="rounded-full border border-[#00ff88]/25 bg-[#00ff88]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#87ffc4]">
                    Hot
                  </span>
                )}
                {token.isGraduated && (
                  <span className="rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/12 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#c4b5fd]">
                    Graduated
                  </span>
                )}
                {isNearGrad && !token.isGraduated && (
                  <span className="rounded-full border border-[#ffcf5a]/30 bg-[#ffcf5a]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffdf8c]">
                    Near Grad
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <div
              className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
              style={{ background: rug.bg, borderColor: rug.border, color: rug.color }}
            >
              {rug.label === "Low Risk" ? "🛡️" : rug.label === "Medium Risk" ? "⚠️" : "🔴"} {rug.label}
            </div>
            <div className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-white/50">
              {token.holders.toLocaleString()} holders
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">Market Cap</div>
              <div className="mt-2 text-sm font-bold text-white">{token.marketCapSol.toFixed(2)} SOL</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#00ff88]/[0.05] p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">24H Volume</div>
              <div className="mt-2 text-sm font-bold text-[#8dffc9]">{token.volume24h.toFixed(2)} SOL</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">Trades</div>
              <div className="mt-2 text-sm font-bold text-white">{token.trades.toLocaleString()}</div>
            </div>
          </div>

          {!token.isGraduated && (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Bonding Curve</span>
                <span className={clsx("text-xs font-mono font-semibold", isNearGrad ? "text-[#ffcf5a]" : "text-[#8dffc9]")}>
                  {graduationPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={clsx(
                    "progress-bar-fill h-full rounded-full",
                    isNearGrad && "near-grad"
                  )}
                  style={{ width: `${graduationPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/[0.08] pt-3">
            <span className="text-[11px] text-white/38">{timeAgo(token.createdAt)}</span>
            {token.isGraduated ? (
              <span className="text-[11px] font-medium text-[#c4b5fd]">🎓 Trading on DEX</span>
            ) : token.realSolReserves ? (
              <span className="text-[11px] font-mono text-white/52">
                {formatSol(new BN(token.realSolReserves))} SOL raised
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
