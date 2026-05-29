import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "What Is an SPL Token? Solana Token Standard Explained (2026)",
  description:
    "SPL tokens are Solana's native token standard — the equivalent of ERC-20 on Ethereum. Learn what SPL tokens are, how they work, how to create one in under 60 seconds, and how the bonding curve model prices them.",
  keywords: [
    "what is SPL token",
    "SPL token explained",
    "Solana token standard",
    "create SPL token",
    "SPL vs ERC-20",
    "Solana fungible token",
    "how to create a Solana token",
    "SPL token 2026",
  ],
  alternates: { canonical: "https://jetforge.io/blog/what-is-an-spl-token" },
  openGraph: {
    type: "article",
    url: "https://jetforge.io/blog/what-is-an-spl-token",
    title: "What Is an SPL Token? Solana Token Standard Explained (2026)",
    description: "SPL tokens are Solana's native fungible token standard. Learn what they are, how they work, and how to create one for free.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "What is an SPL token?" }],
    siteName: "JetForge",
    publishedTime: "2026-05-01T00:00:00Z",
    modifiedTime: "2026-05-29T00:00:00Z",
    authors: ["JetForge Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "What Is an SPL Token? Solana Token Standard Explained",
    description: "Everything you need to know about SPL tokens — Solana's native fungible token standard.",
    images: ["/og-image.jpg"],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "What Is an SPL Token? Solana Token Standard Explained (2026)",
  description: "SPL tokens are Solana's native token standard — the equivalent of ERC-20 on Ethereum.",
  datePublished: "2026-05-01",
  dateModified: "2026-05-29",
  url: "https://jetforge.io/blog/what-is-an-spl-token",
  author: { "@type": "Organization", name: "JetForge Team" },
  publisher: {
    "@type": "Organization",
    name: "JetForge",
    logo: { "@type": "ImageObject", url: "https://jetforge.io/logo.png" },
  },
  image: "https://jetforge.io/og-image.jpg",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://jetforge.io/blog/what-is-an-spl-token" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is an SPL token?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An SPL token is a fungible token built on the Solana blockchain using the SPL (Solana Program Library) token standard. SPL tokens are analogous to ERC-20 tokens on Ethereum. They can represent currencies, meme coins, governance tokens, reward points, or any other fungible asset on Solana.",
      },
    },
    {
      "@type": "Question",
      name: "How do I create an SPL token?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The easiest way to create an SPL token in 2026 is to use a no-code launchpad like JetForge. Connect a Phantom or Solflare wallet, go to jetforge.io/launch, fill in your token name, symbol, image, and description, then sign the transaction. Your SPL token is live on a bonding curve in under 60 seconds with approximately 0.025 SOL in network rent.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between SPL and ERC-20?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SPL is Solana's token standard, while ERC-20 is Ethereum's equivalent. The key difference is performance: Solana processes thousands of transactions per second with fees under $0.001, versus Ethereum's slower throughput and higher gas costs. Both standards define fungible tokens, but the technical implementation differs significantly.",
      },
    },
  ],
};

export default function WhatIsAnSplTokenPage() {
  const esc = (obj: object) =>
    JSON.stringify(obj).replace(/</g, "<").replace(/>/g, ">").replace(/&/g, "&");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: esc(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: esc(faqJsonLd) }} />

      <div className="max-w-3xl mx-auto py-10 px-4 space-y-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/35">
          <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-white/70 transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-white/55">What Is an SPL Token?</span>
        </nav>

        {/* Hero */}
        <header className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/25 rounded-full px-2.5 py-1">Education</span>
            <span className="text-xs text-white/30">7 min read</span>
            <span className="text-xs text-white/30">·</span>
            <time dateTime="2026-05-29" className="text-xs text-white/30">May 2026</time>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            What Is an SPL Token? Solana Token Standard Explained (2026)
          </h1>
          <p className="text-white/60 leading-7 text-lg">
            SPL tokens are the native fungible token standard on Solana — the equivalent of ERC-20 on
            Ethereum. Every meme coin, DeFi token, and NFT collection on Solana is built on SPL.
            Here&apos;s how they work, and how to create one in under 60 seconds.
          </p>
        </header>

        {/* TL;DR */}
        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 space-y-3">
          <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest">TL;DR — Quick Answer</h2>
          <ul className="space-y-2 text-white/70 text-sm leading-6">
            <li className="flex gap-2"><span className="text-blue-400 mt-0.5 shrink-0">→</span><span>An <strong className="text-white">SPL token</strong> is a fungible token on Solana built using the SPL (Solana Program Library) token standard. Think of it as the Solana equivalent of an ERC-20 token on Ethereum.</span></li>
            <li className="flex gap-2"><span className="text-blue-400 mt-0.5 shrink-0">→</span><span>Every Solana meme coin, stablecoin, and DeFi token is an SPL token — including BONK, WIF, and all tokens launched on JetForge.</span></li>
            <li className="flex gap-2"><span className="text-blue-400 mt-0.5 shrink-0">→</span><span>You can create your own SPL token in under 60 seconds on <Link href="/launch" className="text-blue-400 hover:underline">JetForge</Link> — no coding required, costs ~0.025 SOL.</span></li>
          </ul>
        </section>

        {/* What is SPL */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">What Is an SPL Token?</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              <strong className="text-white">SPL</strong> stands for <strong className="text-white">Solana Program Library</strong> — a
              collection of on-chain programs (smart contracts) that define standard interfaces for tokens,
              governance, and other primitives on the Solana blockchain.
            </p>
            <p>
              The SPL Token program defines the standard for creating and managing fungible tokens on Solana.
              When someone creates a new token on Solana, they deploy a <strong className="text-white">token mint</strong> — an
              on-chain account that records the token&apos;s supply, decimals, and who has authority to mint or
              freeze tokens. Every wallet that holds the token has a corresponding <strong className="text-white">token account</strong> that
              tracks their balance.
            </p>
            <p>
              All major Solana tokens — SOL-based stablecoins like USDC, meme coins like BONK and WIF,
              governance tokens, and reward tokens — are SPL tokens. They are interoperable with every
              wallet, DEX, and DeFi protocol on Solana without any additional configuration.
            </p>
          </div>
        </section>

        {/* SPL vs ERC-20 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">SPL Token vs ERC-20: Key Differences</h2>
          <p className="text-white/60 leading-7">
            If you are familiar with Ethereum&apos;s ERC-20 standard, here is how SPL tokens compare:
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Feature</th>
                  <th className="text-left px-4 py-3 text-[#9945FF] font-medium">SPL (Solana)</th>
                  <th className="text-left px-4 py-3 text-blue-400 font-medium">ERC-20 (Ethereum)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["Transaction speed", "~400ms finality", "12-15 second blocks"],
                  ["Transaction fee", "< $0.001", "$0.50 – $50+ (gas)"],
                  ["Token standard", "SPL Token Program", "ERC-20 interface"],
                  ["Wallet support", "Phantom, Solflare, etc.", "MetaMask, Ledger, etc."],
                  ["DEX ecosystem", "Raydium, Jupiter, Orca", "Uniswap, Curve, Balancer"],
                  ["Creation cost", "~0.025 SOL (~$4)", "~$50-500 in gas"],
                  ["Account model", "Account-based (parallel)", "Account-based (sequential)"],
                  ["Smart contract language", "Rust / Anchor", "Solidity"],
                ].map(([feature, sol, eth]) => (
                  <tr key={feature}>
                    <td className="px-4 py-3 text-white font-medium">{feature}</td>
                    <td className="px-4 py-3 text-white/70">{sol}</td>
                    <td className="px-4 py-3 text-white/50">{eth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-white/50 text-sm">
            Solana&apos;s lower fees and higher throughput make it the preferred chain for meme coins and
            high-frequency trading tokens where transaction costs and speed matter.
          </p>
        </section>

        {/* How SPL tokens work */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">How SPL Tokens Work Under the Hood</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>Understanding the key accounts in the SPL token model helps you understand what you&apos;re actually doing when you create or trade a token:</p>
            <div className="space-y-3">
              {[
                { name: "Token Mint Account", color: "#9945FF", desc: "The global record for your token. Stores total supply, decimals (1-9), and the mint authority (who can create new tokens). On JetForge, the bonding curve program controls minting — no individual can inflate supply arbitrarily." },
                { name: "Token Account (ATA)", color: "#00ff88", desc: "Each wallet gets an Associated Token Account (ATA) for each SPL token it holds. Your ATA records your balance for that specific token. ATAs cost ~0.002 SOL to create (rent) — this is why wallets sometimes show a small SOL cost when you first receive a new token." },
                { name: "Mint Authority", color: "#ffcc00", desc: "The entity that can create new tokens. On a bonding curve launchpad, the smart contract holds mint authority and issues tokens as buyers purchase on the curve. For fixed-supply tokens, mint authority is typically burned (set to null) to prevent inflation." },
                { name: "Freeze Authority", color: "#ff8800", desc: "Optional. Allows a designated address to freeze token accounts. Most meme coins and fair-launch tokens do not set a freeze authority — check the token mint details on Solana Explorer." },
              ].map(({ name, color, desc }) => (
                <div key={name} className="rounded-xl border border-white/8 bg-white/[0.025] p-4 space-y-1">
                  <div className="font-semibold text-sm" style={{ color }}>{name}</div>
                  <p className="text-xs text-white/55 leading-5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How to create */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">How to Create an SPL Token — No Coding Required</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              You can create an SPL token without writing any code. The easiest method is using
              JetForge&apos;s no-code launchpad:
            </p>
          </div>
          <div className="space-y-3">
            {[
              { n: 1, title: "Connect a Solana wallet", body: "Install Phantom or Solflare, fund it with at least 0.03 SOL, and connect at jetforge.io." },
              { n: 2, title: "Go to jetforge.io/launch", body: "Fill in your token name, symbol (2-8 characters), and description. Upload a square image (PNG, JPG, GIF, or WebP)." },
              { n: 3, title: "Set optional social links", body: "Add Twitter, Telegram, and website URLs. Tokens with social links have higher Anti-Rug Scores and attract more buyers." },
              { n: 4, title: "Click Launch and sign the transaction", body: "JetForge creates the SPL token mint, seeds the bonding curve, and makes your token immediately tradeable — all in one transaction." },
              { n: 5, title: "Share your token page", body: "Your token is live at jetforge.io/token/[mint]. Share the link and earn 40% of all trading fees as creator." },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-4">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm mt-0.5">{n}</div>
                <div className="space-y-1 pb-4 border-b border-white/5 flex-1 last:border-0 last:pb-0">
                  <div className="font-semibold text-white">{title}</div>
                  <p className="text-sm text-white/60 leading-6">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {[
              { q: "What is an SPL token?", a: "An SPL token is a fungible token built on the Solana blockchain using the SPL (Solana Program Library) token standard. SPL tokens are analogous to ERC-20 tokens on Ethereum. They can represent currencies, meme coins, governance tokens, or any other fungible asset on Solana." },
              { q: "How much does it cost to create an SPL token?", a: "Creating an SPL token on JetForge costs approximately 0.025 SOL in Solana network rent (paid to the Solana network to store the mint account on-chain). JetForge charges no listing fee. There is also a 1% trading fee on all buy and sell transactions on the bonding curve — 40% of which goes back to you as the creator." },
              { q: "What is the difference between an SPL token and a Solana NFT?", a: "SPL fungible tokens (like meme coins) are interchangeable — 1 BONK equals any other 1 BONK. SPL non-fungible tokens (NFTs) are unique — each one is distinct. Both use the SPL token standard, but NFTs typically have a supply of 1 and use the Metaplex standard for metadata." },
              { q: "Can I create an SPL token without coding?", a: "Yes. JetForge is a fully no-code SPL token launchpad. You fill out a form in a browser, connect your wallet, and sign one transaction. No Rust, Anchor, or CLI experience is required." },
              { q: "What wallets support SPL tokens?", a: "All major Solana wallets support SPL tokens, including Phantom, Solflare, Backpack, and Ledger hardware wallets with Solana support. Any wallet that supports Solana automatically supports all SPL tokens." },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-white/8 bg-white/[0.025] p-5 space-y-2">
                <h3 className="font-semibold text-white text-sm">{q}</h3>
                <p className="text-sm text-white/60 leading-6">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-8 text-center space-y-4">
          <div className="text-white font-bold text-xl">Create Your Own SPL Token in 60 Seconds</div>
          <p className="text-sm text-white/55 max-w-md mx-auto leading-6">No coding. ~0.025 SOL launch cost. 40% of trading fees back to you as creator. Auto-graduation to Raydium.</p>
          <Link href="/launch" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-xl transition-colors text-sm">
            Launch an SPL Token on JetForge →
          </Link>
        </div>

        {/* Related */}
        <div className="border-t border-white/8 pt-8 space-y-3">
          <div className="text-xs text-white/30 uppercase tracking-widest font-medium">Related Articles</div>
          <Link href="/blog/how-to-launch-a-token-on-solana" className="block text-blue-400 hover:underline text-sm">How to Launch a Token on Solana in Under 60 Seconds →</Link>
          <Link href="/blog/what-is-a-bonding-curve" className="block text-white/50 hover:text-white text-sm transition-colors">What Is a Bonding Curve? →</Link>
          <Link href="/blog/solana-meme-coin-guide" className="block text-white/50 hover:text-white text-sm transition-colors">Solana Meme Coin Guide →</Link>
        </div>

      </div>
    </>
  );
}
