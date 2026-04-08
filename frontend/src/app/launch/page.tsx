"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LaunchForm } from "@/components/LaunchForm";

export default function LaunchPage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🚀</div>
        <h1 className="text-3xl font-bold text-white mb-2">Launch Your Token</h1>
        <p className="text-[#666] text-sm max-w-md mx-auto">
          Create a token with a bonding curve. No presale, no team allocation —
          fair launch for everyone.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {[
          "🛡️ Anti-rug by design",
          "📈 Constant product curve",
          "⚡ Instant liquidity",
          "🎓 Auto DEX graduation",
          "💰 1% trade fee",
        ].map((feature) => (
          <span
            key={feature}
            className="px-3 py-1.5 bg-[#111] border border-[#1a1a1a] rounded-full text-[#666] text-xs"
          >
            {feature}
          </span>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-5 mb-8">
        <div className="text-[#555] text-xs font-medium mb-4">HOW IT WORKS</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div key={item.step} className="flex items-start gap-3">
              <div className="text-2xl shrink-0">{item.icon}</div>
              <div>
                <div className="text-white text-sm font-semibold">{item.title}</div>
                <div className="text-[#555] text-xs mt-0.5">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Launch form */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-6">
        <LaunchForm onSuccess={(mint) => router.push(`/token/${mint}`)} />
      </div>

      {/* Disclaimer */}
      <p className="text-center text-[#333] text-xs mt-6">
        By launching a token you agree that this is purely for experimentation.
        This is not financial advice. Trade responsibly.
      </p>
    </div>
  );
}
