import type { Metadata } from "next";
import FaqAccordion from "./FaqAccordion";

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: "FAQ — JetForge Help & Common Questions",
  description:
    "Answers to the most common questions about JetForge: how bonding curves work, token creation, fees, wallet support, graduation, and trading on Solana.",
  openGraph: {
    title: "FAQ — JetForge Help & Common Questions",
    description:
      "Everything you need to know about launching and trading tokens on JetForge.",
    url: "https://jetforge.io/faq",
    siteName: "JetForge",
    images: [{ url: "https://jetforge.io/og-image.jpg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ — JetForge Help & Common Questions",
    description: "Common questions about JetForge token launches on Solana.",
    images: ["https://jetforge.io/og-image.jpg"],
  },
  alternates: { canonical: "https://jetforge.io/faq" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is JetForge?",
      "acceptedAnswer": { "@type": "Answer", "text": "JetForge is a fair-launch token launchpad on Solana. Anyone can create and trade tokens using an automated bonding curve AMM, with no presales, no team allocations, and automatic graduation to Raydium at 85 SOL market cap." }
    },
    {
      "@type": "Question",
      "name": "How much does it cost to launch a token on JetForge?",
      "acceptedAnswer": { "@type": "Answer", "text": "Launching a token costs approximately 0.025 SOL in Solana network rent. There are no listing fees or developer token allocations. JetForge charges a 1% trading fee on each buy and sell transaction on the bonding curve." }
    },
    {
      "@type": "Question",
      "name": "What is a bonding curve?",
      "acceptedAnswer": { "@type": "Answer", "text": "A bonding curve is an automated market maker (AMM) where the token price increases as more people buy and decreases as people sell. The price is determined mathematically by the ratio of SOL to tokens in the pool, ensuring a fair price discovery without order books." }
    },
    {
      "@type": "Question",
      "name": "What happens when a token graduates?",
      "acceptedAnswer": { "@type": "Answer", "text": "When a token reaches 85 SOL in market capitalization on the bonding curve, it automatically graduates to Raydium — Solana's largest decentralised exchange. JetForge provides the initial liquidity for the Raydium pool. The token can then be traded on Raydium by anyone." }
    },
    {
      "@type": "Question",
      "name": "Is JetForge safe to use?",
      "acceptedAnswer": { "@type": "Answer", "text": "JetForge is fully non-custodial — we never hold your funds or private keys. The platform uses open-source smart contracts deployed on Solana. Each token has an anti-rug score (0-100) based on creator history, whale concentration, and trading patterns. However, all token trading carries financial risk, and smart contracts have not been formally audited by a third party." }
    },
    {
      "@type": "Question",
      "name": "Do I need coding experience to launch a token?",
      "acceptedAnswer": { "@type": "Answer", "text": "No coding experience is required. JetForge is a fully no-code platform. You only need a Solana wallet (Phantom or Solflare), at least 0.03 SOL to cover network fees, and a token name and symbol. The entire launch process takes under 60 seconds." }
    },
    {
      "@type": "Question",
      "name": "What wallets does JetForge support?",
      "acceptedAnswer": { "@type": "Answer", "text": "JetForge supports all major Solana wallets including Phantom, Solflare, Backpack, Coinbase Wallet, and any wallet using the Solana Wallet Adapter standard. Both desktop browser extensions and mobile wallets are supported." }
    },
    {
      "@type": "Question",
      "name": "How is JetForge different from pump.fun?",
      "acceptedAnswer": { "@type": "Answer", "text": "JetForge and pump.fun are both Solana bonding curve launchpads, but JetForge offers additional features including multi-interval price charts (1m, 5m, 15m, 1h, 4h), whale alerts, an anti-rug scoring system, creator leaderboards, and a portfolio PnL tracker. Both charge 1% trading fees. JetForge graduates tokens at 85 SOL market cap while pump.fun graduates at approximately 69 SOL bonding curve fill." }
    }
  ]
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="max-w-3xl mx-auto py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Frequently Asked Questions
          </h1>
          <p className="text-[#555] text-sm">
            Everything you need to know about JetForge and Solana token launches.
          </p>
        </div>
        <FaqAccordion />
      </div>
    </>
  );
}
