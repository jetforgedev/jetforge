"use client";
import React, { useState } from "react";

const FAQS = [
  {
    q: "What is JetForge?",
    a: "JetForge is a decentralized token launchpad on Solana. Anyone can create a token with a bonding curve — a smart contract that automatically sets the price based on supply and demand. No presales, no VC allocations. Fair launch for everyone.",
  },
  {
    q: "How does the bonding curve work?",
    a: "We use a constant product formula (x × y = k). As more people buy, the price increases. As people sell, the price decreases. The curve starts at ~0.000028 SOL per token and rises as the market cap grows toward the 0.5 SOL graduation threshold.",
  },
  {
    q: "What happens when a token graduates?",
    a: "When a token raises 0.5 SOL on the bonding curve, it graduates to a DEX (Raydium/Orca). The SOL and reserve tokens are used to create a permanent liquidity pool. Trading then continues on the DEX at the market price. The token creator receives 5% of raised SOL (~0.025 SOL) as a graduation reward.",
  },
  {
    q: "Can the token creator rug pull?",
    a: "No. The bonding curve is immutable — creators cannot withdraw SOL from it. All tokens are minted to the bonding curve vault, not the creator's wallet. The only thing a creator can do is buy their own token early (visible in Dev Holdings on each token page).",
  },
  {
    q: "What fees does JetForge charge?",
    a: "Every trade has a 1% fee. This is split: 40% to the token creator, 40% to the platform treasury, and 20% to a buyback-and-burn vault. The buyback vault automatically burns tokens when it accumulates 0.5 SOL, reducing supply over time.",
  },
  {
    q: "What wallet do I need?",
    a: "JetForge supports Phantom wallet on Solana devnet. Install the Phantom browser extension, fund your wallet with devnet SOL (use Solana's faucet at faucet.solana.com), then connect via the 'Select Wallet' button.",
  },
  {
    q: "How do I get devnet SOL for testing?",
    a: "Visit faucet.solana.com, enter your wallet address, and request devnet SOL. You can also run `solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet` in the terminal.",
  },
  {
    q: "How much does it cost to create a token?",
    a: "Creating a token costs approximately 0.025 SOL in Solana rent fees (for mint account, bonding curve state, token vaults, and metadata). This is a one-time cost paid to the Solana network, not to JetForge.",
  },
  {
    q: "What is slippage and how do I set it?",
    a: "Slippage is the maximum price difference you'll accept between when you submit a trade and when it executes. Default is 1%. You can adjust it in the trading panel. Higher slippage = more likely to succeed but potentially worse price.",
  },
  {
    q: "Why did my transaction fail?",
    a: "Common reasons: insufficient SOL balance (including fees), slippage exceeded (price moved before your tx confirmed), network congestion, or RPC issues. Try increasing slippage tolerance or waiting for the network to clear.",
  },
  {
    q: "Is JetForge audited?",
    a: "The smart contracts have not been formally audited by a third party yet. Use the platform with caution and only invest amounts you're comfortable losing. An audit is planned before mainnet launch.",
  },
  {
    q: "When is mainnet launch?",
    a: "JetForge is currently on Solana devnet for testing. Mainnet launch timing will be announced on our social channels after thorough testing and a security audit.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#1a1a1a] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#111] transition-colors"
      >
        <span className="text-white text-sm font-medium">{q}</span>
        <span className={`text-[#555] text-lg transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      {open && (
        <div className="px-5 pb-4 text-[#888] text-sm leading-relaxed border-t border-[#1a1a1a] pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Frequently Asked Questions</h1>
        <p className="text-[#555] text-sm">Everything you need to know about JetForge</p>
      </div>
      <div className="space-y-3">
        {FAQS.map((faq) => (
          <FaqItem key={faq.q} q={faq.q} a={faq.a} />
        ))}
      </div>
    </div>
  );
}
