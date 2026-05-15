import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "How to Launch a Token on Solana in Under 60 Seconds",
  description:
    "Step-by-step guide to creating and launching your own Solana SPL token using JetForge. No coding required. Connect a wallet, fill out the form, pay ~0.025 SOL, and your token is live on a bonding curve instantly.",
  keywords: [
    "how to launch a token on Solana",
    "create Solana token",
    "launch meme coin Solana",
    "Solana token launchpad tutorial",
    "fair launch token Solana",
    "bonding curve token launch",
  ],
  alternates: { canonical: "https://jetforge.io/blog/how-to-launch-a-token-on-solana" },
  openGraph: {
    type: "article",
    url: "https://jetforge.io/blog/how-to-launch-a-token-on-solana",
    title: "How to Launch a Token on Solana in Under 60 Seconds",
    description:
      "Step-by-step guide: connect Phantom, fill the form, pay ~0.025 SOL, and your token is live on JetForge's bonding curve.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Launch a Solana token with JetForge" }],
    siteName: "JetForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Launch a Solana Token in 60 Seconds",
    description: "Step-by-step guide using JetForge. No coding. Just a wallet and a great idea.",
    images: ["/og-image.jpg"],
  },
};

const howtoJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Launch a Token on Solana",
  description:
    "Step-by-step guide to creating and launching a Solana SPL token using the JetForge fair-launch bonding curve launchpad.",
  totalTime: "PT2M",
  estimatedCost: { "@type": "MonetaryAmount", currency: "SOL", value: "0.025" },
  url: "https://jetforge.io/blog/how-to-launch-a-token-on-solana",
  step: [
    {
      "@type": "HowToStep",
      name: "Get a Solana wallet with SOL",
      text: "Install Phantom Wallet (phantom.app) and add at least 0.05 SOL to cover the token creation rent (~0.025 SOL) and initial buy if desired.",
      position: 1,
    },
    {
      "@type": "HowToStep",
      name: "Go to the JetForge Launch page",
      text: "Navigate to jetforge.io/launch and click Connect Wallet. Approve the connection in your Phantom wallet.",
      position: 2,
      url: "https://jetforge.io/launch",
    },
    {
      "@type": "HowToStep",
      name: "Fill in your token details",
      text: "Enter your token name, ticker symbol (2-8 characters), upload an image, and write a description. Optionally add a website, Twitter, or Telegram link.",
      position: 3,
    },
    {
      "@type": "HowToStep",
      name: "Optionally make an initial buy",
      text: "You can buy an initial amount of your own token at launch to seed the bonding curve. This is optional and visible on-chain.",
      position: 4,
    },
    {
      "@type": "HowToStep",
      name: "Sign and confirm the transaction",
      text: "Phantom will prompt you to approve two transactions: the token creation (paying ~0.025 SOL in network rent) and optionally the initial purchase.",
      position: 5,
    },
    {
      "@type": "HowToStep",
      name: "Share your token page",
      text: "Your token is now live on-chain and visible on JetForge. Share the URL with your community. Anyone can buy and sell immediately.",
      position: 6,
    },
  ],
};

const faqs = [
  {
    q: "How much SOL do I need to launch a token?",
    a: "You need approximately 0.025 SOL to cover the Solana network rent fee for creating the token account. This goes to the Solana network, not JetForge. If you want to make an initial purchase at launch, add more SOL accordingly.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. JetForge handles all the on-chain smart contract interactions. You just fill out a form, connect your wallet, and sign the transaction. No Rust, no Anchor, no CLI required.",
  },
  {
    q: "Can the token creator get a special allocation?",
    a: "No. JetForge is a fair-launch platform. The token creator receives 0% special allocation. Every token starts at the same price on the bonding curve, and the creator can only buy at market price like everyone else.",
  },
  {
    q: "What happens when my token reaches 85 SOL?",
    a: "When the bonding curve accumulates 85 SOL, the token automatically graduates to Raydium DEX. The bonding curve closes, the SOL reserve and proportional token supply seed a Raydium liquidity pool, and open-market trading begins. This process is fully automated by the smart contract.",
  },
  {
    q: "Do I earn anything as a token creator?",
    a: "Yes. JetForge allocates 40% of all trading fees on your token to a creator vault. For every 1 SOL traded, 0.004 SOL goes to your creator vault. You can withdraw this at any time from the token page.",
  },
  {
    q: "Can I rug pull my token?",
    a: "No special mechanism exists for the creator to rug pull. The creator receives no special token allocation and cannot drain the bonding curve. Funds in the curve are controlled by the smart contract. JetForge also publishes an anti-rug score per token showing the creator wallet activity.",
  },
];

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00ff8820] border border-[#00ff8840] flex items-center justify-center text-[#00ff88] font-bold text-sm mt-0.5">
        {n}
      </div>
      <div className="space-y-1 pb-6 border-b border-white/5 flex-1 last:border-0 last:pb-0">
        <div className="font-semibold text-white">{title}</div>
        <p className="text-sm text-white/55 leading-6">{body}</p>
      </div>
    </div>
  );
}

export default function HowToPage() {
  const esc = (obj: object) =>
    JSON.stringify(obj).replace(/</g, "\u003c").replace(/>/g, "\u003e").replace(/&/g, "\u0026");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: esc(howtoJsonLd) }} />

      <div className="max-w-3xl mx-auto py-10 px-4 space-y-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/35">
          <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-white/70 transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-white/55">How to Launch a Token</span>
        </nav>

        {/* Hero */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#00ff88] bg-[#00ff8810] border border-[#00ff8825] rounded-full px-2.5 py-1">Guide</span>
            <span className="text-xs text-white/30">5 min read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            How to Launch a Token on Solana in Under 60 Seconds
          </h1>
          <p className="text-white/55 leading-7 text-lg">
            JetForge lets anyone create and launch a Solana SPL token with a fair-launch bonding
            curve — no coding, no presales, no team allocations. Here is exactly how to do it.
          </p>
        </div>

        {/* What you need */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">What you need</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { icon: "👛", title: "Phantom Wallet", body: "Install from phantom.app. Any Solana wallet that supports Solana dApps works." },
              { icon: "◎", title: "~0.05 SOL", body: "~0.025 SOL for token creation rent. Add more if you want to make an initial buy." },
              { icon: "💡", title: "A token idea", body: "Name, ticker (2-8 chars), image, and a description. That is all." },
            ].map(({ icon, title, body }) => (
              <div key={title} className="rounded-xl border border-white/8 bg-white/[0.025] p-4 space-y-2">
                <div className="text-2xl">{icon}</div>
                <div className="font-semibold text-white text-sm">{title}</div>
                <div className="text-xs text-white/50 leading-5">{body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="space-y-0">
          <h2 className="text-xl font-bold text-white mb-6">Step-by-step instructions</h2>
          <Step n={1} title="Get SOL in your wallet"
            body="Buy SOL on any centralised exchange (Coinbase, Binance, Kraken) and withdraw to your Phantom address. You need at least 0.05 SOL — 0.025 SOL for the token creation rent, plus a buffer for transaction fees." />
          <Step n={2} title="Go to jetforge.io/launch"
            body="Open JetForge in your browser and navigate to the Launch page. Click Connect Wallet in the top-right corner. Approve the connection request in Phantom. You will see your wallet address appear once connected." />
          <Step n={3} title="Fill in your token details"
            body="Enter your token name (e.g. 'SupraDoge'), ticker symbol (e.g. 'SDOGE', max 8 characters), upload a square image (PNG or JPG), and write a description. Optionally add your Twitter, Telegram, or website URL. These appear on your token page." />
          <Step n={4} title="Set an optional initial buy"
            body="You can buy an initial amount of your own token at launch. This seeds the bonding curve and shows buyers that you have skin in the game. It is optional — you can launch with 0 SOL initial buy. Any initial buy is visible on-chain." />
          <Step n={5} title="Click Launch and sign the transaction"
            body="Click the Launch button. Phantom will prompt you to sign one transaction (or two if you made an initial buy). Review the SOL amount and confirm. The transaction lands on Solana in a few seconds." />
          <Step n={6} title="Share your token page"
            body="Your token is now live on-chain and indexed by JetForge. You will be taken to your token page at jetforge.io/token/[mint]. Share this URL on Twitter, Telegram, or anywhere your community lives. Anyone can buy and sell immediately." />
        </section>

        {/* What happens next */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">What happens after launch</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              Once live, your token trades exclusively on JetForge&apos;s bonding curve. The price
              rises as people buy and falls as people sell — automatically, with no manual
              market-making required.
            </p>
            <p>
              As the creator, you earn <strong className="text-white">40% of all trading fees</strong> generated
              by your token, deposited into a creator vault on-chain. You can withdraw this from your
              token page at any time — even before graduation.
            </p>
            <p>
              When your token accumulates <strong className="text-white">85 SOL</strong> in the
              bonding curve, it automatically graduates to Raydium. The curve closes, a Raydium
              liquidity pool is seeded, and your token becomes tradeable on any Solana DEX aggregator.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Frequently asked questions</h2>
          <div className="space-y-3">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group rounded-xl border border-white/8 bg-white/[0.025] overflow-hidden">
                <summary className="px-5 py-4 text-sm font-medium text-white cursor-pointer list-none flex items-center justify-between gap-3">
                  {q}
                  <span className="text-white/30 group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-white/55 leading-6">{a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-[#00ff88]/20 bg-[#00ff88]/5 p-6 text-center space-y-4">
          <div className="text-white font-bold text-lg">Ready to launch your token?</div>
          <p className="text-sm text-white/55">Fair launch. Bonding curve. Auto-graduation to Raydium. No coding.</p>
          <Link href="/launch" className="inline-flex items-center gap-2 bg-[#00ff88] text-black font-bold px-6 py-3 rounded-xl hover:bg-[#00dd77] transition-colors text-sm">
            🚀 Launch a Token Now
          </Link>
        </div>

        {/* Related */}
        <div className="border-t border-white/8 pt-8 space-y-3">
          <div className="text-xs text-white/30 uppercase tracking-widest">Related</div>
          <Link href="/blog/jetforge-vs-pumpfun" className="block text-[#00ff88] hover:underline text-sm">
            JetForge vs pump.fun — Which Launchpad Should You Use? →
          </Link>
          <Link href="/faq" className="block text-white/50 hover:text-white text-sm transition-colors">
            Full FAQ →
          </Link>
        </div>

      </div>
    </>
  );
}
