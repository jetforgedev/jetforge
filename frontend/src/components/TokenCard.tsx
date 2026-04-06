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

  // Generated avatar based on mint address
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

export function TokenCard({ token }: TokenCardProps) {
  const graduationPct = Math.min(100, token.graduationProgress || 0);
  const isNearGrad = graduationPct >= 80;

  return (
    <Link href={`/token/${token.mint}`}>
      <div className="token-card bg-[#111] border border-[#1a1a1a] rounded-xl p-4 cursor-pointer">
        {/* Top row */}
        <div className="flex items-start gap-3 mb-3">
          <TokenAvatar
            name={token.name}
            imageUrl={token.imageUrl}
            mint={token.mint}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-white text-sm truncate">
                {token.name}
              </span>
              <span className="text-[#555] text-xs font-mono shrink-0">
                {token.symbol}
              </span>
            </div>
            <div className="text-[#666] text-xs truncate">
              by {truncateAddress(token.creator)}
            </div>
          </div>
          {/* Anti-rug badge */}
          <div className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 bg-[#00ff8810] border border-[#00ff8830] rounded-md">
            <span className="text-[10px]">🛡️</span>
            <span className="text-[#00ff88] text-[10px] font-medium">Safe</span>
          </div>
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
        {token.isGraduated ? (
          <div className="flex items-center gap-2 bg-[#7c3aed20] border border-[#7c3aed30] rounded-lg px-3 py-2">
            <span className="text-sm">🎓</span>
            <span className="text-[#a78bfa] text-xs font-medium">
              Graduated to DEX
            </span>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[#555] text-[10px]">BONDING CURVE</span>
              <span
                className={clsx(
                  "text-[10px] font-mono font-medium",
                  isNearGrad ? "text-yellow-400" : "text-[#666]"
                )}
              >
                {graduationPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-500",
                  isNearGrad
                    ? "bg-gradient-to-r from-[#00ff88] to-yellow-400"
                    : "bg-[#00ff88]"
                )}
                style={{ width: `${graduationPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]">
          <span className="text-[#555] text-[10px]">
            {timeAgo(token.createdAt)}
          </span>
          {token.realSolReserves && (
            <span className="text-[#666] text-[10px] font-mono">
              {formatSol(new BN(token.realSolReserves))} SOL raised
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
