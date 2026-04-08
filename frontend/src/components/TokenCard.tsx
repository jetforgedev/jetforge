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

export function TokenCard({ token, isWatched = false, onWatchToggle }: TokenCardProps) {
  const graduationPct = Math.min(100, token.graduationProgress || 0);
  const isNearGrad = graduationPct >= 80;
  const rug = computeRugScore(token);
  const trending = isTrending(token);

  return (
    <div className="relative">
      {/* Watchlist star button */}
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
          "token-card bg-[#111] border rounded-xl p-4 cursor-pointer transition-colors",
          trending ? "border-[#00ff8830] hover:border-[#00ff8850]" : "border-[#1a1a1a]"
        )}>
          {/* Top row */}
          <div className="flex items-start gap-3 mb-3">
            <TokenAvatar name={token.name} imageUrl={token.imageUrl} mint={token.mint} />
            <div className="flex-1 min-w-0 pr-5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-white text-sm truncate">{token.name}</span>
                <span className="text-[#555] text-xs font-mono shrink-0">{token.symbol}</span>
                {trending && (
                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#ff6b0020] border border-[#ff6b0040] text-[#ff9900]">
                    🔥 Hot
                  </span>
                )}
              </div>
              <div className="text-[#666] text-xs truncate">by {truncateAddress(token.creator)}</div>
            </div>
          </div>

          {/* Rug score + Safe badge row */}
          <div className="flex items-center gap-2 mb-3">
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
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <div className="text-[#555] text-[10px] mb-0.5">MARKET CAP</div>
              <div className="text-white text-xs font-mono font-medium">
                {token.marketCapSol.toFixed(2)} SOL
              </div>
            </div>
            <div>
              <div className="text-[#555] text-[10px] mb-0.5">VOLUME 24H</div>
              <div className="text-white text-xs font-mono font-medium">
                {token.volume24h.toFixed(2)} SOL
              </div>
            </div>
            <div>
              <div className="text-[#555] text-[10px] mb-0.5">TRADES</div>
              <div className="text-white text-xs font-mono font-medium">
                {token.trades.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Graduation progress */}
          {!token.isGraduated && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[#555] text-[10px]">BONDING CURVE</span>
                <span className={clsx("text-[10px] font-mono font-medium", isNearGrad ? "text-yellow-400" : "text-[#666]")}>
                  {graduationPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className={clsx("h-full rounded-full transition-all duration-500", isNearGrad ? "bg-gradient-to-r from-[#00ff88] to-yellow-400" : "bg-[#00ff88]")}
                  style={{ width: `${graduationPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]">
            <span className="text-[#555] text-[10px]">{timeAgo(token.createdAt)}</span>
            {token.isGraduated ? (
              <span className="text-[#a78bfa] text-[10px] font-medium">🎓 Trading on DEX</span>
            ) : token.realSolReserves ? (
              <span className="text-[#666] text-[10px] font-mono">
                {formatSol(new BN(token.realSolReserves))} SOL raised
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
