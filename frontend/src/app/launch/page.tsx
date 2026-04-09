"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LaunchForm } from "@/components/LaunchForm";

export default function LaunchPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(0,255,136,0.10),rgba(255,255,255,0.03)_35%,rgba(0,204,255,0.10))] px-6 py-10 text-center shadow-[0_28px_70px_rgba(0,0,0,0.26)] sm:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(0,255,136,0.18),transparent_28%)]" />
        <div className="relative">
          <div className="mb-4 text-5xl animate-float">🚀</div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00ff88]/18 bg-[#00ff88]/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8dffc9]">
            Creator Wizard
          </div>
          <h1 className="text-4xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">Launch Your Token</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/62 sm:text-base">
            Create a token, wire it into JetForge&apos;s bonding curve, and start trading instantly. No presale, no team allocation, just pure fair-launch energy.
          </p>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap justify-center gap-2.5">
        {[
          "🛡️ Anti-rug by design",
          "📈 Constant product curve",
          "⚡ Instant liquidity",
          "🎓 Auto DEX graduation",
          "💰 1% trade fee",
        ].map((feature) => (
          <span
            key={feature}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/58 backdrop-blur-sm"
          >
            {feature}
          </span>
        ))}
      </div>

      <div className="glass-panel mb-8 rounded-[28px] p-6">
        <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">How It Works</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Launch",
              desc: "Fill in your token details and deploy to Solana",
              icon: "🚀",
            },
            {
              step: "2",
              title: "Trade",
              desc: "Anyone can buy and sell using the bonding curve",
              icon: "💱",
            },
            {
              step: "3",
              title: "Graduate",
              desc: "At 0.5 SOL raised, liquidity moves to a DEX permanently",
              icon: "🎓",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#00ff88]/15 bg-[#00ff88]/10 text-lg">
                  {item.icon}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8dffc9]">
                  Step {item.step}
                </div>
              </div>
              <div className="text-white text-sm font-semibold">{item.title}</div>
              <div className="mt-1 text-xs leading-6 text-white/48">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel-dark rounded-[30px] p-4 sm:p-6">
        <LaunchForm onSuccess={(mint) => router.push(`/token/${mint}`)} />
      </div>

      <p className="mt-6 text-center text-xs text-white/30">
        By launching a token you agree that this is purely for experimentation. This is not financial advice. Trade responsibly.
      </p>
    </div>
  );
}
