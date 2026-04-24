"use client";

import React, { useState } from "react";
import { clsx } from "clsx";
import BN from "bn.js";
import { GRADUATION_THRESHOLD } from "@/lib/bondingCurve";

interface GraduationBarProps {
  realSolReserves: string;
  isGraduated: boolean;
  mint?: string;
  raydiumPoolId?: string;
}

// ── Phase config ────────────────────────────────────────────────────────────
// Single source of truth for phase colors used across the component.
const PHASES = [
  { threshold: 25,  label: "EARLY",   color: "#4fc3f7", bg: "#4fc3f710", border: "#4fc3f730" },
  { threshold: 50,  label: "BUILDING", color: "#00cc77", bg: "#00cc7710", border: "#00cc7730" },
  { threshold: 85,  label: "HOT 🔥",   color: "#ffaa00", bg: "#ffaa0015", border: "#ffaa0030" },
  { threshold: 101, label: "FINAL 🚀", color: "#ff6b6b", bg: "#ff6b6b15", border: "#ff6b6b40" },
] as const;

// FINAL PHASE TRIGGER — used consistently throughout this file
const FINAL_PHASE_PCT = 85;

function getPhase(progress: number) {
  return PHASES.find((p) => progress < p.threshold) ?? PHASES[PHASES.length - 1];
}

// Milestone breakpoints must match PHASES thresholds
function getNextMilestone(progress: number, solTarget: number): string | null {
  const milestones = [25, 50, 85, 100];
  const next = milestones.find((m) => m > progress);
  if (!next) return null;
  const solAtMilestone = ((next / 100) * solTarget).toFixed(3);
  return `Next milestone: ${next}% · ${solAtMilestone} SOL`;
}

// ── Minimal tooltip — works on hover (desktop) and tap (mobile) ─────────────
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="ml-1 text-[#444] hover:text-[#666] text-[11px] leading-none cursor-help select-none"
        aria-label="Info"
      >
        ⓘ
      </button>
      {open && (
        <span
          className="absolute top-full left-0 mt-1.5 z-50 w-56 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] px-3 py-2 text-[11px] text-[#aaa] shadow-2xl pointer-events-none leading-[1.6] whitespace-normal"
          style={{ minWidth: "200px" }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function GraduationBar({ realSolReserves, isGraduated, mint, raydiumPoolId }: GraduationBarProps) {
  const realSol = new BN(realSolReserves || "0");
  const target = GRADUATION_THRESHOLD;
  const progress = Math.min(100, (realSol.toNumber() / target.toNumber()) * 100);
  const isFinalPhase = progress >= FINAL_PHASE_PCT;
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
      <div className="rounded-[24px] sm:rounded-[28px] border border-[#8b5cf6]/25 bg-[linear-gradient(135deg,rgba(139,92,246,0.16),rgba(255,255,255,0.03))] p-3 sm:p-5 shadow-[0_24px_50px_rgba(0,0,0,0.2)]">
        <div className="mb-3 sm:mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#8b5cf6]/18 text-xl sm:text-3xl shadow-[0_0_28px_rgba(139,92,246,0.16)]">
            🎓
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] sm:tracking-[0.22em] text-[#c4b5fd]">
              Graduated to DEX
            </div>
            <div className="mt-0.5 text-xs sm:text-sm leading-5 sm:leading-6 text-white/58">
              <span className="sm:hidden">Now trading on a DEX.</span>
              <span className="hidden sm:inline">This token completed its bonding curve and is now trading on a decentralized exchange.</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={raydiumSwapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-[#8b5cf6]/35 bg-[#8b5cf6]/16 py-2.5 sm:py-3 text-sm font-semibold text-[#ddd6fe] transition-colors hover:bg-[#8b5cf6]/24"
          >
            Trade on Raydium ↗
          </a>
          {raydiumPoolId && (
            <a
              href={raydiumPoolUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 sm:py-3 text-sm font-semibold text-white/72 transition-colors hover:bg-white/[0.08]"
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
        "relative rounded-[24px] sm:rounded-[28px] border bg-white/[0.04] p-3 sm:p-5",
        isFinalPhase
          ? "animate-glow-pulse border-[#ff6b6b]/40 shadow-[0_0_40px_rgba(255,107,107,0.12)]"
          : "border-white/10 shadow-[0_24px_50px_rgba(0,0,0,0.18)]"
      )}
    >
      <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_68%)]" />
      {isFinalPhase && (
        <div className="absolute inset-0 overflow-hidden rounded-[24px] sm:rounded-[28px] pointer-events-none">
          <div className="absolute inset-y-0 left-[-35%] w-1/3 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)]" />
        </div>
      )}

      {/* Header */}
      <div className="relative mb-3 sm:mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#00ff88]/10 text-sm sm:text-lg">
            {isFinalPhase ? "🚀" : "📈"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center text-sm font-semibold text-white">
              Bonding Curve Progress
              <InfoTooltip text="Buys push the bonding curve upward. When the target is reached, liquidity is deployed to a DEX and trading continues there." />
            </div>
            <div className="text-xs leading-4 text-white/42 truncate">
              {isFinalPhase
                ? "Final push — every buy brings this closer to the DEX!"
                : "Liquidity building toward DEX graduation"}
            </div>
          </div>
        </div>

        {/* Phase badge + % */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span
            className="rounded-full border px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.16em]"
            style={{ color: phase.color, background: phase.bg, borderColor: phase.border }}
          >
            {phase.label}
          </span>
          <span className="text-base sm:text-lg font-mono font-bold" style={{ color: phase.color }}>
            {progress.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mb-3 sm:mb-4 overflow-hidden rounded-[18px] sm:rounded-[22px] border border-white/8 bg-[#081713] p-2.5 sm:p-4">
        <div className="mb-1.5 sm:mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          <span>Curve Fill</span>
          <span>{Math.max(0, 100 - progress).toFixed(1)}% remaining</span>
        </div>
        <div className="h-3 sm:h-4 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={clsx("progress-bar-fill h-full rounded-full transition-all duration-700", isFinalPhase && "near-grad")}
            style={{ width: `${progress}%` }}
          />
        </div>
        {nextMilestone && (
          <div className="mt-1.5 sm:mt-2 inline-block text-[10px] font-mono px-1.5 py-0.5 rounded"
               style={{ color: phase.color, background: phase.color + "18" }}>
            {nextMilestone}
          </div>
        )}
      </div>

      {/* Final phase callout — compact on mobile */}
      {isFinalPhase && (
        <div className="mb-3 sm:mb-4 rounded-xl sm:rounded-2xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-3 py-2 sm:px-4 sm:py-3 text-center">
          <div className="text-sm font-bold text-[#ff9090]">🚀 Final push to the DEX!</div>
          <div className="text-xs text-white/50 mt-0.5 hidden sm:block">
            This token is about to graduate — buy now before it moves to the DEX.
          </div>
        </div>
      )}

      {/* Stats grid — 3 cols on all sizes; compact on mobile */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        <div className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/[0.04] p-2 sm:p-3">
          <div className="mb-0.5 sm:mb-1 text-[9px] sm:text-[10px] uppercase tracking-[0.14em] sm:tracking-[0.18em] text-white/32">Raised</div>
          <div className="font-mono text-xs sm:text-sm font-semibold text-white leading-snug">
            {solRaised.toFixed(2)}<span className="text-[#555] text-[9px] sm:text-[10px]"> SOL</span>
          </div>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/[0.04] p-2 sm:p-3">
          <div className="mb-0.5 sm:mb-1 text-[9px] sm:text-[10px] uppercase tracking-[0.14em] sm:tracking-[0.18em] text-white/32">Target</div>
          <div className="font-mono text-xs sm:text-sm font-semibold text-white leading-snug">
            {solTarget.toFixed(0)}<span className="text-[#555] text-[9px] sm:text-[10px]"> SOL</span>
          </div>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/[0.04] p-2 sm:p-3">
          <div className="mb-0.5 sm:mb-1 text-[9px] sm:text-[10px] uppercase tracking-[0.14em] sm:tracking-[0.18em] text-white/32">Status</div>
          <div className="text-xs sm:text-sm font-semibold leading-snug" style={{ color: phase.color }}>
            {phase.label}
          </div>
        </div>
      </div>

      <div className="mt-3 sm:mt-4 border-t border-white/[0.08] pt-2.5 sm:pt-4 text-xs leading-5 sm:leading-6 text-white/42">
        <span className="sm:hidden">Graduates at {solTarget.toFixed(0)} SOL raised.</span>
        <span className="hidden sm:inline">When this curve reaches {solTarget.toFixed(3)} SOL, liquidity is automatically deployed to a DEX and trading continues there.</span>
      </div>
    </div>
  );
}
