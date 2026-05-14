"use client";
import React, { useState } from "react";

const FAQS = [
  {
    q: "What is JetForge?",
    a: "JetForge is a fair-launch token platform on Solana. Anyone can create a token in under 30 seconds — no presales, no team allocations. Tokens launch on a bonding curve and graduate to Raydium automatically when fully funded.",
  },
  {
    q: "How does the bonding curve work?",
    a: "Every token starts on an xy=k bonding curve. Early buyers get a lower price; as more SOL flows in, the price rises. When the curve reaches its funding target (~85 SOL), liquidity is automatically migrated to Raydium DEX.",
  },
  {
    q: "What fees does JetForge charge?",
    a: "JetForge charges a small trading fee on each buy and sell. The token creator receives 5% of the graduation liquidity as a reward for launching a successful token.",
  },
  {
    q: "Is JetForge safe to use?",
    a: "JetForge is a devnet experiment. Bonding-curve trading is volatile and experimental. Never invest more than you can afford to lose. Read the full disclaimer before trading.",
  },
  {
    q: "How do I create a token?",
    a: "Connect your Phantom or Solflare wallet, go to the Launch page, fill in your token name, symbol, description, and upload an image. Your token is live in under 30 seconds.",
  },
  {
    q: "What happens after a token graduates?",
    a: "When a token's bonding curve is fully funded, JetForge automatically migrates the liquidity to a Raydium pool. The token creator receives a 5% reward, and trading continues on Raydium.",
  },
  {
    q: "Which wallets are supported?",
    a: "JetForge supports Phantom and Solflare on both desktop and mobile. On mobile, use the in-app browser or the deep-link to open directly in your wallet.",
  },
  {
    q: "Why is my transaction failing?",
    a: "Try increasing your slippage tolerance in the trading panel and ensure you have enough SOL for network fees. If the issue persists, refresh the page and try again.",
  },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      {FAQS.map((faq, i) => (
        <div key={i}>
          <button
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-sm font-semibold text-white">{faq.q}</span>
            <span className="ml-4 text-[#00ff88] text-lg leading-none">
              {open === i ? "−" : "+"}
            </span>
          </button>
          {open === i && (
            <div className="px-5 pb-4 text-sm text-white/55 leading-relaxed">
              {faq.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
