"use client";

import React from "react";
import { clsx } from "clsx";
import BN from "bn.js";
import { GRADUATION_THRESHOLD, formatSol } from "@/lib/bondingCurve";

interface GraduationBarProps {
  realSolReserves: string;
  isGraduated: boolean;
}

export function GraduationBar({ realSolReserves, isGraduated }: GraduationBarProps) {
  const realSol = new BN(realSolReserves || "0");
  const target = GRADUATION_THRESHOLD;
  const progress = Math.min(
    100,
    (realSol.toNumber() / target.toNumber()) * 100
  );
  const isNearGrad = progress >= 80;
  const solRaised = Number(realSolReserves) / 1e9;
  const solTarget = Number(target.toString()) / 1e9;

  if (isGraduated) {
    return (
      <div className="bg-[#7c3aed15] border border-[#7c3aed40] rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🎓</div>
          <div>
            <div className="text-[#a78bfa] font-semibold text-sm">
              Graduated to DEX!
            </div>
            <div className="text-[#666] text-xs mt-0.5">
              This token has graduated and is now trading on a decentralized exchange.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "bg-[#111] border rounded-xl p-4 transition-all",
        isNearGrad
          ? "border-yellow-500/30 animate-pulse-glow"
          : "border-[#1a1a1a]"
      )}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">📈</span>
          <span className="text-white text-sm font-semibold">
            Bonding Curve Progress
          </span>
          {isNearGrad && (
            <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-400 text-[10px] font-medium">
              GRADUATING SOON
            </span>
          )}
        </div>
        <span
          className={clsx(
            "text-sm font-mono font-bold",
            isNearGrad ? "text-yellow-400" : "text-[#00ff88]"
          )}
        >
          {progress.toFixed(1)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-[#1a1a1a] rounded-full overflow-hidden mb-3">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-700",
            isNearGrad
              ? "bg-gradient-to-r from-[#00ff88] to-yellow-400"
              : "bg-[#00ff88]"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex justify-between items-center text-xs">
        <div className="text-[#666]">
          <span className="font-mono text-white font-medium">
            {solRaised.toFixed(3)} SOL
          </span>{" "}
          raised
        </div>
        <div className="text-[#666]">
          Target:{" "}
          <span className="font-mono text-white font-medium">
            {solTarget} SOL
          </span>
        </div>
      </div>

      {/* Graduation info */}
      <div className="mt-3 pt-3 border-t border-[#1a1a1a] text-[#555] text-xs">
        When this curve reaches {solTarget} SOL, liquidity will be automatically
        deployed to a DEX and trading will continue there.
      </div>
    </div>
  );
}
