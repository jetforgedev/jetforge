"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LaunchForm } from "@/components/LaunchForm";

export default function LaunchPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative mb-4 sm:mb-8 overflow-hidden rounded-2xl sm:rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(0,255,136,0.10),rgba(255,255,255,0.03)_35%,rgba(0,204,255,0.10))] px-4 py-5 sm:px-10 sm:py-10 text-center shadow-[0_28px_70px_rgba(0,0,0,0.26)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(0,255,136,0.18),transparent_28%)]" />
        <div className="relative">
          <div className="mb-2 sm:mb-4 text-3xl sm:text-5xl animate-float">🚀</div>
          <div className="mb-2 sm:mb-3 inline-flex items-center gap-2 rounded-full border border-[#00ff88]/18 bg-[#00ff88]/8 px-3 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.28em] text-[#8dffc9]">
            Creator Wizard
          </div>
          <h1 className="text-2xl sm:text-5xl font-extrabold tracking-[-0.04em] text-white">Launch Your Token</h1>
          <p className="mx-auto mt-2 sm:mt-4 max-w-2xl text-[12px] sm:text-base leading-5 sm:leading-7 text-white/62">
            Create a token, deploy to Solana, and start trading instantly. No presale, no team allocation.
          </p>
        </div>
      </div>

      <div className="mb-4 sm:mb-8 flex flex-wrap justify-center gap-1.5 sm:gap-2.5">
        {[
          "🛡️ Anti-rug",
          "📈 Constant curve",
          "⚡ Instant liquidity",
          "🎓 Auto graduation",
          "💰 1% fee",
        ].map((feature) => (
          <span
            key={feature}
            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-medium text-white/58 backdrop-blur-sm whitespace-nowrap"
          >
            {feature}
          </span>
        ))}
      </div>

      <div className="glass-panel mb-4 sm:mb-8 rounded-2xl sm:rounded-[28px] p-3 sm:p-6">
        <div className="mb-3 sm:mb-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">How It Works</div>
        <div className="grid grid-cols-1 gap-2 sm:gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Launch",   desc: "Fill in your token details and deploy to Solana",          icon: "🚀" },
            { step: "2", title: "Trade",    desc: "Anyone can buy and sell using the bonding curve",          icon: "💱" },
            { step: "3", title: "Graduate", desc: "At 0.5 SOL raised, liquidity moves to a DEX permanently", icon: "🎓" },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl sm:rounded-[24px] border border-white/8 bg-white/[0.04] p-3 sm:p-4 flex sm:flex-col items-center sm:items-start gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-[#00ff88]/15 bg-[#00ff88]/10 text-base sm:text-lg">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8dffc9] sm:mb-1">
                  Step {item.step} · {item.title}
                </div>
                <div className="hidden sm:block text-white text-sm font-semibold">{item.title}</div>
                <div className="text-[11px] sm:text-xs leading-4 sm:leading-5 text-white/48 mt-0.5 sm:mt-1">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel-dark rounded-2xl sm:rounded-[30px] p-3 sm:p-6">
        <LaunchForm onSuccess={(mint) => router.push(`/token/${mint}`)} />
      </div>

      <p className="mt-4 sm:mt-6 text-center text-[11px] sm:text-xs leading-5 text-white/30">
        By launching a token you agree this is purely for experimentation. Not financial advice. Trade responsibly.
      </p>
    </div>
  );
}
