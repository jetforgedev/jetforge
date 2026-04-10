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
      <div className="relative h-full w-full overflow-hidden rounded-[12px] border border-white/10 sm:rounded-2xl">
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
      className="flex h-full w-full items-center justify-center rounded-[12px] text-sm font-bold text-black shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:rounded-2xl"
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
    <div className="relative h-full">
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

      <Link href={`/token/${token.mint}`} className="block h-full">
        <div
          className={clsx(
            "token-card relative flex h-full flex-col overflow-hidden rounded-[16px] border bg-white/[0.03] p-2.5 backdrop-blur-sm sm:rounded-[26px] sm:p-4",
            "border-white/[0.08] shadow-[0_18px_40px_rgba(0,0,0,0.18)]",
            trending && "before:absolute before:inset-0 before:rounded-[16px] before:border before:border-[#00ff88]/25 before:content-[''] before:animate-shimmer sm:before:rounded-[26px]",
            isNearGrad && "animate-glow-pulse border-[#ffcf5a]/35"
          )}
        >
          <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_70%)]" />

          {/* Header: avatar + name + badges */}
          <div className="relative mb-2 flex items-start gap-2 sm:mb-3.5 sm:gap-3">
            <div className="relative h-11 w-11 shrink-0 sm:h-14 sm:w-14">
              <TokenAvatar name={token.name} imageUrl={token.imageUrl} mint={token.mint} />
            </div>
            <div className="min-w-0 flex-1 pr-7">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-bold tracking-tight text-white sm:text-[15px]">{token.name}</span>
                <span className="shrink-0 text-[10px] font-mono text-white/38">{token.symbol}</span>
              </div>
              <div className="truncate text-[10px] text-white/40">by {truncateAddress(token.creator)}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {trending && (
                  <span className="rounded-full border border-[#00ff88]/25 bg-[#00ff88]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#87ffc4]">
                    Hot
                  </span>
                )}
                {token.isGraduated && (
                  <span className="rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#c4b5fd]">
                    Graduated
                  </span>
                )}
                {isNearGrad && !token.isGraduated && (
                  <span className="rounded-full border border-[#ffcf5a]/30 bg-[#ffcf5a]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#ffdf8c]">
                    Near Grad
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Risk + holders */}
          <div className="mb-2 flex items-center gap-1.5 sm:mb-3 sm:gap-2">
            <div
              className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold sm:px-2.5 sm:py-1 sm:text-[10px]"
              style={{ background: rug.bg, borderColor: rug.border, color: rug.color }}
            >
              {rug.label === "Low Risk" ? "🛡️" : rug.label === "Medium Risk" ? "⚠️" : "🔴"} {rug.label}
            </div>
            <div className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-white/50 sm:px-2.5 sm:py-1 sm:text-[10px]">
              {token.holders.toLocaleString()} holders
            </div>
          </div>

          {/* Stats grid */}
          <div className="mb-2 grid grid-cols-3 gap-1.5 sm:mb-3.5 sm:gap-2.5">
            <div className="rounded-[10px] border border-white/20 bg-white/[0.07] p-1.5 sm:rounded-2xl sm:p-3" style={{ boxShadow: "0 0 24px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.20)" }}>
              <div className="truncate text-[8px] uppercase tracking-[0.12em] text-white/35 sm:text-[10px] sm:tracking-[0.16em]">Mkt Cap</div>
              <div className="mt-1 whitespace-nowrap text-[11px] font-bold text-white sm:mt-2 sm:text-sm">{token.marketCapSol.toFixed(2)}<span className="text-[9px] text-white/50"> SOL</span></div>
            </div>
            <div className="rounded-[10px] border border-[#00ff88]/40 bg-[#00ff88]/[0.09] p-1.5 sm:rounded-2xl sm:p-3" style={{ boxShadow: "0 0 24px rgba(0,255,136,0.30), inset 0 1px 0 rgba(0,255,136,0.25)" }}>
              <div className="truncate text-[8px] uppercase tracking-[0.12em] text-white/35 sm:text-[10px] sm:tracking-[0.16em]">Volume</div>
              <div className="mt-1 whitespace-nowrap text-[11px] font-bold text-[#8dffc9] sm:mt-2 sm:text-sm">{token.volume24h.toFixed(2)}<span className="text-[9px] text-[#8dffc9]/60"> SOL</span></div>
            </div>
            <div className="rounded-[10px] border border-white/20 bg-white/[0.07] p-1.5 sm:rounded-2xl sm:p-3" style={{ boxShadow: "0 0 24px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.20)" }}>
              <div className="truncate text-[8px] uppercase tracking-[0.12em] text-white/35 sm:text-[10px] sm:tracking-[0.16em]">Trades</div>
              <div className="mt-1 whitespace-nowrap text-[11px] font-bold text-white sm:mt-2 sm:text-sm">{token.trades.toLocaleString()}</div>
            </div>
          </div>

          {/* Bonding curve — pinned to bottom */}
          <div className="mt-auto mb-2 sm:mb-3.5">
            {!token.isGraduated ? (
              <>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35 sm:text-[10px] sm:tracking-[0.18em]">Bonding Curve</span>
                <span className={clsx("text-[10px] font-mono font-semibold", isNearGrad ? "text-[#ffcf5a]" : "text-[#8dffc9]")}>
                  {graduationPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full border border-white/6 bg-[#081a16]">
                <div
                  className={clsx("progress-bar-fill h-full rounded-full", isNearGrad && "near-grad")}
                  style={{ width: `${graduationPct}%` }}
                />
              </div>
              <div className="mt-1 text-[9px] text-white/32 sm:mt-2 sm:text-[10px]">
                {Math.max(0, 100 - graduationPct).toFixed(1)}% left to graduation
              </div>
              </>
            ) : (
              <div className="rounded-[10px] border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 px-2.5 py-1.5 text-[10px] font-medium text-[#d8ccff] sm:rounded-2xl sm:px-3 sm:py-2 sm:text-[11px]">
                Trading has moved to the DEX after graduation.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/[0.08] pt-2 sm:pt-3">
            <span className="text-[10px] text-white/38 sm:text-[11px]">{timeAgo(token.createdAt)}</span>
            {token.isGraduated ? (
              <span className="text-[10px] font-medium text-[#c4b5fd] sm:text-[11px]">🎓 Trading on DEX</span>
            ) : token.realSolReserves ? (
              <span className="text-[10px] font-mono text-white/52 sm:text-[11px]">
                {formatSol(new BN(token.realSolReserves))} SOL raised
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
