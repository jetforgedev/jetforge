"use client";

import React from "react";
import { clsx } from "clsx";
import BN from "bn.js";
import { GRADUATION_THRESHOLD } from "@/lib/bondingCurve";

interface GraduationBarProps {
  realSolReserves: string;
  isGraduated: boolean;
  mint?: string;
  raydiumPoolId?: string;
}

function getPhase(progress: number): { label: string; color: string; bg: string; border: string } {
  if (progress < 25)  return { label: "EARLY",    color: "#4fc3f7", bg: "#4fc3f710", border: "#4fc3f730" };
  if (progress < 60)  return { label: "BUILDING",  color: "#a5d6a7", bg: "#a5d6a710", border: "#a5d6a730" };
  if (progress < 85)  return { label: "HOT 🔥",    color: "#ffaa00", bg: "#ffaa0015", border: "#ffaa0030" };
  return               { label: "FINAL 🚀",  color: "#ff6b6b", bg: "#ff6b6b15", border: "#ff6b6b40" };
}

function getNextMilestone(progress: number, solTarget: number): string | null {
  const milestones = [25, 50, 75, 90, 100];
  const next = milestones.find((m) => m > progress);
  if (!next) return null;
  const solAtMilestone = ((next / 100) * solTarget).toFixed(2);
  return `Next milestone: ${next}% (${solAtMilestone} SOL)`;
}

export function GraduationBar({ realSolReserves, isGraduated, mint, raydiumPoolId }: GraduationBarProps) {
  const realSol = new BN(realSolReserves || "0");
  const target = GRADUATION_THRESHOLD;
  const progress = Math.min(100, (realSol.toNumber() / target.toNumber()) * 100);
  const isNearGrad = progress >= 80;
  const isFinalPhase = progress >= 85;
  const solRaised = Number(realSolReserves) / 1e9;
  const solTarget = Number(target.toString()) / 1e9;
  const phase = getPhase(progress);
  const nextMilestone = getNextMilestone(progress, solTarget);

  if (isGraduated) {
    const raydiumSwapUrl = mint
      ? `https://raydium.io/swap/?inputMint=sol&outputMint=${mint}`
      : "https://raydium.io";

    const raydiumPoolUrl = raydiumPoolId
      ? `https://raydium.io/liquidity/pool/${raydiumPoolId}`
      : raydiumSwapUrl;

    return (
      <div className="rounded-[28px] border border-[#8b5cf6]/25 bg-[linear-gradient(135deg,rgba(139,92,246,0.16),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_50px_rgba(0,0,0,0.2)]">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#8b5cf6]/18 text-3xl shadow-[0_0_28px_rgba(139,92,246,0.16)]">
            🎓
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c4b5fd]">
              Graduated to DEX
            </div>
            <div className="mt-1 text-sm leading-6 text-white/58">
              This token completed its curve and is now trading on a decentralized exchange.
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={raydiumSwapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-[#8b5cf6]/35 bg-[#8b5cf6]/16 py-3 text-sm font-semibold text-[#ddd6fe] transition-colors hover:bg-[#8b5cf6]/24"
          >
            Trade on Raydium ↗
          </a>
          {raydiumPoolId && (
            <a
              href={raydiumPoolUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/72 transition-colors hover:bg-white/[0.08]"
            >
              Pool ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[28px] border bg-white/[0.04] p-4 sm:p-5",
        isFinalPhase
          ? "animate-glow-pulse border-[#ff6b6b]/40 shadow-[0_0_40px_rgba(255,107,107,0.12)]"
          : isNearGrad
          ? "animate-glow-pulse border-[#ffcf5a]/35"
          : "border-white/10 shadow-[0_24px_50px_rgba(0,0,0,0.18)]"
      )}
    >
      <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_68%)]" />
      {isNearGrad && (
        <div className="absolute inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute inset-y-0 left-[-35%] w-1/3 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]" />
        </div>
      )}

      <div className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#00ff88]/10 text-lg">
            {isFinalPhase ? "🚀" : "📈"}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Bonding Curve Progress</div>
            <div className="text-xs leading-5 text-white/42">
              {isFinalPhase
                ? "Final push — every buy brings this closer to the DEX!"
                : "Liquidity marches toward DEX graduation"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap justify-end">
          {/* Phase badge */}
          <span
            className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: phase.color, background: phase.bg, borderColor: phase.border }}
          >
            {phase.label}
          </span>
          {isNearGrad && (
            <span className="rounded-full border border-[#ffcf5a]/30 bg-[#ffcf5a]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffdf8c]">
              Near Graduation
            </span>
          )}
          <span className={clsx("text-lg font-mono font-bold", isFinalPhase ? "text-[#ff6b6b]" : isNearGrad ? "text-[#ffcf5a]" : "text-[#00ff88]")}>
            {progress.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="relative mb-4 overflow-hidden rounded-[22px] border border-white/8 bg-[#081713] p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          <span>Curve Fill</span>
          <span>{Math.max(0, 100 - progress).toFixed(1)}% remaining</span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={clsx("progress-bar-fill h-full rounded-full transition-all duration-700", isNearGrad && "near-grad")}
            style={{ width: `${progress}%` }}
          />
        </div>
        {nextMilestone && (
          <div className="mt-2 text-[10px] text-white/38 font-mono">{nextMilestone}</div>
        )}
      </div>

      {isFinalPhase && (
        <div className="mb-4 rounded-2xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-4 py-3 text-center">
          <div className="text-sm font-bold text-[#ff9090]">🚀 Final push to the DEX!</div>
          <div className="text-xs text-white/50 mt-0.5">This token is about to graduate — buy now before it moves to Raydium.</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 text-xs text-white/46 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
          <div className="mb-1 uppercase tracking-[0.18em] text-white/32">Raised</div>
          <div className="font-mono text-sm font-semibold text-white">{solRaised.toFixed(3)} SOL</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
          <div className="mb-1 uppercase tracking-[0.18em] text-white/32">Target</div>
          <div className="font-mono text-sm font-semibold text-white">{solTarget} SOL</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
          <div className="mb-1 uppercase tracking-[0.18em] text-white/32">Status</div>
          <div
            className="text-sm font-semibold"
            style={{ color: phase.color }}
          >
            {isFinalPhase ? "Almost there 🚀" : isNearGrad ? "Almost there" : "Building liquidity"}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.08] pt-4 text-xs leading-6 text-white/42">
        When this curve reaches {solTarget} SOL, liquidity is automatically deployed to a DEX and trading continues there.
      </div>
    </div>
  );
}
