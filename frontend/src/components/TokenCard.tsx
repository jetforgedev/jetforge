"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { clsx } from "clsx";
import { TokenData, truncateAddress, timeAgo } from "@/lib/api";
import { formatSol } from "@/lib/bondingCurve";
import BN from "bn.js";

const GRADUATION_THRESHOLD_SOL = 0.5; // devnet

interface TokenCardProps {
  token: TokenData;
  isWatched?: boolean;
  onWatchToggle?: () => void;
}

function TokenAvatar({ name, imageUrl, mint }: { name: string; imageUrl?: string; mint: string }) {
  const [imgError, setImgError] = React.useState(false);

  if (imageUrl && !imgError) {
    return (
      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
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
      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-black text-sm"
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
  return (token.volume24h >= 0.5) || (token.trades >= 15 && ageHours < 48);
}

function isJustLaunched(token: TokenData): boolean {
  const ageMs = Date.now() - new Date(token.createdAt).getTime();
  return ageMs < 60 * 60 * 1000; // < 1 hour
}

function isRecentlyActive(token: TokenData): boolean {
  return token.volume24h > 0 && token.trades > 0;
}

export function TokenCard({ token, isWatched = false, onWatchToggle }: TokenCardProps) {
  const graduationPct = Math.min(100, token.graduationProgress || 0);
  const isNearGrad = graduationPct >= 80;
  const rug = computeRugScore(token);
  const trending = isTrending(token);
  const justLaunched = isJustLaunched(token);
  const recentlyActive = isRecentlyActive(token);

  const solRaised = token.realSolReserves ? parseFloat(token.realSolReserves) / 1e9 : 0;
  const solToGrad = Math.max(0, GRADUATION_THRESHOLD_SOL - solRaised);

  // Border styling based on state
  const borderClass = token.isGraduated
    ? "border-[#7c3aed30] hover:border-[#7c3aed60]"
    : trending
    ? "border-[#00ff8830] hover:border-[#00ff8860]"
    : isNearGrad
    ? "border-yellow-400/20 hover:border-yellow-400/40"
    : "border-[#1a1a1a] hover:border-[#2a2a2a]";

  return (
    <div className="relative">
      {/* Watchlist star */}
      {onWatchToggle && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWatchToggle(); }}
          className="absolute top-3 right-3 z-10 text-base leading-none transition-transform hover:scale-110"
          title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
        >
          {isWatched ? "⭐" : "☆"}
        </button>
      )}

      <Link href={`/token/${token.mint}`}>
        <div className={clsx(
          "token-card bg-[#111] border rounded-xl p-4 cursor-pointer transition-all duration-150",
          borderClass,
          trending && !token.isGraduated && "shadow-[0_0_12px_#00ff8810]",
          isNearGrad && !token.isGraduated && "shadow-[0_0_12px_#ffaa0015]",
        )}>

          {/* Top row */}
          <div className="flex items-start gap-3 mb-3">
            <div className="relative">
              <TokenAvatar name={token.name} imageUrl={token.imageUrl} mint={token.mint} />
              {/* Live activity dot */}
              {recentlyActive && !token.isGraduated && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00ff88] border-2 border-[#111] animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-5">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="font-semibold text-white text-sm truncate max-w-[120px]">{token.name}</span>
                <span className="text-[#555] text-xs font-mono shrink-0">{token.symbol}</span>
                {justLaunched && (
                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#00ff8820] border border-[#00ff8840] text-[#00ff88] animate-pulse">
                    🚀 NEW
                  </span>
                )}
                {!justLaunched && trending && (
                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#ff6b0020] border border-[#ff6b0040] text-[#ff9900]">
                    🔥 Hot
                  </span>
                )}
              </div>
              <div className="text-[#555] text-xs truncate">by {truncateAddress(token.creator)}</div>
            </div>
          </div>

          {/* Risk + state badges */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border"
              style={{ background: rug.bg, borderColor: rug.border, color: rug.color }}
            >
              {rug.label === "Low Risk" ? "🛡️" : rug.label === "Medium Risk" ? "⚠️" : "🔴"} {rug.label}
            </div>
            {token.isGraduated && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#7c3aed15] border border-[#7c3aed30] rounded-md text-[10px] text-[#a78bfa]">
                🎓 Graduated
              </div>
            )}
            {isNearGrad && !token.isGraduated && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-400/10 border border-yellow-400/30 rounded-md text-[10px] text-yellow-400 animate-pulse">
                ⚡ Almost there!
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <div className="text-[#555] text-[10px] mb-0.5">MARKET CAP</div>
              <div className="text-white text-xs font-mono font-medium">
                {token.marketCapSol.toFixed(2)} SOL
              </div>
            </div>
            <div>
              <div className="text-[#555] text-[10px] mb-0.5">VOLUME 24H</div>
              <div className={clsx("text-xs font-mono font-medium", token.volume24h > 0 ? "text-[#00ff88]" : "text-white")}>
                {token.volume24h.toFixed(2)} SOL
              </div>
            </div>
            <div>
              <div className="text-[#555] text-[10px] mb-0.5">BUYERS</div>
              <div className={clsx("text-xs font-mono font-medium", token.trades > 0 ? "text-white" : "text-[#444]")}>
                {token.trades > 0 ? `${token.trades.toLocaleString()} 👥` : "—"}
              </div>
            </div>
          </div>

          {/* Graduation progress */}
          {!token.isGraduated && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[#555] text-[10px]">BONDING CURVE</span>
                <div className="flex items-center gap-2">
                  {isNearGrad && solToGrad > 0 && (
                    <span className="text-[9px] text-yellow-400 font-mono">
                      {solToGrad.toFixed(3)} SOL to 🎓
                    </span>
                  )}
                  <span className={clsx("text-[10px] font-mono font-medium", isNearGrad ? "text-yellow-400" : "text-[#666]")}>
                    {graduationPct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-500",
                    isNearGrad
                      ? "bg-gradient-to-r from-[#00ff88] via-yellow-400 to-orange-400"
                      : graduationPct > 50
                      ? "bg-gradient-to-r from-[#00ff88] to-[#00cc6a]"
                      : "bg-[#00ff88]"
                  )}
                  style={{ width: `${graduationPct}%` }}
                />
              </div>
              {/* FOMO text below bar */}
              {isNearGrad && (
                <div className="mt-1 text-[9px] text-yellow-400/80 text-center animate-pulse">
                  🔥 Graduation imminent — early buyers profit most
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]">
            <span className="text-[#555] text-[10px]">{timeAgo(token.createdAt)}</span>
            {token.isGraduated ? (
              <span className="text-[#a78bfa] text-[10px] font-medium">🎓 Live on Raydium</span>
            ) : solRaised > 0 ? (
              <span className="text-[#00ff88] text-[10px] font-mono font-medium">
                {solRaised.toFixed(3)} SOL raised
              </span>
            ) : (
              <span className="text-[#444] text-[10px]">Be first to buy</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
