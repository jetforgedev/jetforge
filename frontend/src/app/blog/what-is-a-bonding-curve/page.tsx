import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "What Is a Bonding Curve? How Solana Token Launchpads Work (2026)",
  description:
    "A bonding curve automatically sets token price based on supply. Learn how bonding curves work, why they enable fair launches, and how JetForge uses one to replace presales on Solana.",
  alternates: { canonical: "https://jetforge.io/blog/what-is-a-bonding-curve" },
  openGraph: {
    type: "article",
    url: "https://jetforge.io/blog/what-is-a-bonding-curve",
    title: "What Is a Bonding Curve? How Solana Token Launchpads Work (2026)",
    description:
      "Bonding curves price tokens algorithmically — no market makers, no presales. See exactly how the math works and why JetForge uses one for every launch.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "What is a Bonding Curve" }],
    siteName: "JetForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "What Is a Bonding Curve? — JetForge",
    description:
      "Bonding curves price tokens automatically from supply alone. No market makers, no presales. How they work and why they matter for Solana launches.",
    images: ["/og-image.jpg"],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "What Is a Bonding Curve? How Solana Token Launchpads Work (2026)",
  description:
    "A bonding curve automatically sets token price based on supply. Learn how bonding curves work, why they enable fair launches, and how JetForge uses one to replace presales on Solana.",
  url: "https://jetforge.io/blog/what-is-a-bonding-curve",
  datePublished: "2026-05-16",
  dateModified: "2026-05-16",
  author: { "@type": "Organization", name: "JetForge Team", url: "https://jetforge.io" },
  publisher: {
    "@type": "Organization",
    name: "JetForge",
    logo: { "@type": "ImageObject", url: "https://jetforge.io/icon.png" },
  },
  image: "https://jetforge.io/og-image.jpg",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://jetforge.io/blog/what-is-a-bonding-curve" },
  keywords: ["bonding curve", "solana token launch", "fair launch", "defi", "meme coin", "token launchpad"],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a bonding curve?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A bonding curve is a mathematical formula that automatically calculates a token's price based on its circulating supply. As more tokens are bought, the price rises. As tokens are sold, the price falls. There is no order book, no market maker, and no human intervention — the contract enforces the price curve deterministically on-chain.",
      },
    },
    {
      "@type": "Question",
      name: "How does a bonding curve prevent rug pulls?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Because the smart contract holds all liquidity and sets the price automatically, the token creator cannot drain liquidity the way they could on a traditional DEX. There are no presale tokens for insiders to dump. Every buyer and seller transacts at the same curve-determined price. JetForge additionally gives every token an anti-rug score (0–100) based on whale concentration and creator history.",
      },
    },
    {
      "@type": "Question",
      name: "What is the constant-product formula used by JetForge?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "JetForge uses a constant-product AMM (k = virtualSol × virtualTokens). At launch, the reserves are seeded with virtual amounts so the curve starts at a low, predictable price. As buyers add real SOL, the virtual SOL reserve grows and the token price rises proportionally. The formula k = x × y = constant ensures every trade moves the price by a calculable amount.",
      },
    },
    {
      "@type": "Question",
      name: "What happens when a token graduates?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When a token's bonding curve accumulates 85 SOL in trading volume, JetForge automatically migrates the token and its liquidity to Raydium — the largest Solana DEX. The migration is triggered on-chain by the smart contract, so neither the creator nor JetForge can block or delay it. After graduation, the token trades on Raydium's open order book like any other asset.",
      },
    },
    {
      "@type": "Question",
      name: "How is JetForge's bonding curve different from pump.fun?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Both platforms use constant-product bonding curves. The key differences are: JetForge charges a flat 1% fee versus pump.fun's higher fee structure; JetForge provides whale alerts, an anti-rug score, and real-time graduation progress that pump.fun lacks; and JetForge's open-source Anchor/Rust program can be independently verified on-chain.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a price impact on large buys?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Because the bonding curve uses a constant-product formula, larger purchases cause greater price impact (slippage). Buying 1 SOL worth of tokens when the pool holds 5 SOL moves the price more than buying 0.1 SOL. JetForge shows real-time price impact estimates before you confirm any trade.",
      },
    },
    {
      "@type": "Question",
      name: "Can the token creator set a different starting price?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. JetForge's smart contract uses fixed virtual reserves at launch, so every token starts at the same initial price regardless of who created it. This is what makes every launch genuinely fair — there are no special pricing deals for the creator.",
      },
    },
    {
      "@type": "Question",
      name: "What does 'virtual reserves' mean?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Virtual reserves are initial values seeded into the AMM formula that do not correspond to real tokens in the pool — they are used purely to set the starting price point. As real SOL enters the pool through buys, the virtual component becomes less significant and the price is driven entirely by real supply and demand.",
      },
    },
  ],
};

export default function WhatIsABondingCurvePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <main className="max-w-3xl mx-auto px-4 py-12 text-white">
        <article>
          <header className="mb-10">
            <p className="text-sm text-gray-400 mb-2">
              <time dateTime="2026-05-16">May 16, 2026</time> · 10 min read · JetForge Team
            </p>
            <h1 className="text-4xl font-bold leading-tight mb-4">
              What Is a Bonding Curve? How Solana Token Launchpads Work (2026)
            </h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              A bonding curve is the engine inside every modern Solana token launchpad. It sets prices
              automatically, eliminates the need for market makers, and makes insider presales
              structurally impossible. Here is a plain-English breakdown of how the math works — and
              why it matters for every token you buy or launch.
            </p>
          </header>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">The Problem Bonding Curves Solve</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Traditional token launches involve a presale: the project sells tokens to private
              investors at a discount before the public ever sees them. Those insiders receive tokens
              at, say, $0.001 and immediately dump them on retail buyers who paid $0.01 on launch day.
              The result is an instant 90 percent loss for anyone who bought at the "official" price.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              Bonding curves fix this by removing presales entirely. There is no private round, no
              seed allocation, and no team bucket. The smart contract is the only market maker. Every
              person who wants tokens — including the creator — buys from the same curve at the same
              price determined solely by supply.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              This is not just a policy choice. It is enforced mathematically on-chain. The contract
              cannot deviate from the curve formula, and because there is no off-chain liquidity pool
              to drain, there is no traditional rug-pull vector.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">How a Bonding Curve Works: The Math</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              The most common bonding curve model — and the one JetForge uses — is the
              constant-product formula, identical to Uniswap v2:
            </p>
            <div className="bg-gray-800 rounded-lg p-4 font-mono text-green-400 text-sm mb-4">
              k = x × y = constant
            </div>
            <p className="text-gray-300 leading-relaxed mb-4">
              Where <strong>x</strong> is the SOL reserve, <strong>y</strong> is the token reserve,
              and <strong>k</strong> is the invariant that the contract preserves after every trade.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              When a buyer sends Δx SOL into the pool, the contract calculates how many tokens Δy
              they receive such that (x + Δx) × (y − Δy) = k. The result is that the price — defined
              as SOL per token — rises after every purchase and falls after every sale.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              Concretely, if the pool holds 10 SOL and 1,000,000 tokens, the current price is
              10 ÷ 1,000,000 = 0.00001 SOL per token. If a buyer adds 1 SOL:
            </p>
            <div className="bg-gray-800 rounded-lg p-4 font-mono text-green-400 text-sm mb-4">
              {`new_y = k / (x + Δx) = (10 × 1,000,000) / (10 + 1) ≈ 909,091 tokens remaining
tokens out = 1,000,000 − 909,091 = 90,909 tokens
new price = 11 / 909,091 ≈ 0.0000121 SOL per token (+21% from 1 SOL buy)`}
            </div>
            <p className="text-gray-300 leading-relaxed mb-4">
              The price impact is larger when the pool is small (early in the curve) and smaller when
              the pool has accumulated significant liquidity (later in the curve). This is why early
              buyers take on more slippage risk but also benefit most from subsequent price
              appreciation.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Virtual Reserves: Why the First Price Is Predictable</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              A pure constant-product pool seeded with real tokens would start at an undefined price
              — you cannot divide by zero. To solve this, JetForge seeds the pool with{" "}
              <strong>virtual reserves</strong>: pre-set x and y values that exist only in the
              contract math, not as real tokens held.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              These virtual reserves set a fixed starting price for every token launch on JetForge.
              The first real buyer sees a predictable entry price, and as real SOL accumulates the
              virtual component becomes irrelevant — the price is driven entirely by actual supply and
              demand.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              Because the virtual reserves are hard-coded in the program, no token creator can ask for
              a lower starting price. Every launch begins at the same point on the same curve — a
              structural guarantee of fairness, not a policy promise.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Price Impact and Slippage</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Because every buy pushes the price up and every sell pushes it down, a bonding curve has
              inherent slippage. The amount of slippage depends on the size of the trade relative to
              the pool depth. JetForge shows a real-time price impact estimate before you confirm any
              transaction so you are never surprised.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              Slippage is not a bug — it is the mechanism by which the curve creates a continuous,
              manipulation-resistant price signal. Wash trading is expensive on a bonding curve
              because every round-trip buy-then-sell loses value to slippage and the 1% fee.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              JetForge's whale alert system flags wallets that purchase more than a configurable
              percentage of the supply in a single block. Large buys are visible to all participants
              before the buyer can extract profit, adding a social-deterrent layer on top of the
              mathematical one.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Graduation: From Bonding Curve to Raydium</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              The bonding curve is designed to be temporary. Once a token accumulates enough SOL in
              its pool — the graduation threshold on JetForge is 85 SOL — the smart contract
              automatically migrates the token and its entire liquidity to Raydium, Solana's largest
              DEX.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              Migration is triggered on-chain and requires no action from the creator or from
              JetForge. The SOL and tokens move atomically in a single transaction that is visible to
              every block explorer. After graduation, the token trades on Raydium's open order book
              alongside thousands of other Solana assets.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              The 85 SOL threshold represents a market cap at which external liquidity providers and
              larger exchanges are willing to take the token seriously. Reaching graduation is
              therefore a meaningful signal of community demand — not just price speculation.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              JetForge displays a real-time graduation progress bar on every token page so buyers can
              see exactly how far the token is from Raydium listing at any moment.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Why Bonding Curves Are Better Than Presales for Buyers</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              In a traditional token launch with a presale, insiders hold tokens at a cost basis
              orders of magnitude below retail. The moment trading opens, those insiders have every
              incentive to sell. Retail buyers absorb that supply and typically lose money.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              On a bonding curve, <strong>no insider exists</strong>. The only way to accumulate a
              large position is to buy it on the curve at the same price as everyone else — which means
              paying a significant premium relative to the starting price. That premium disincentivizes
              early dumping because the early large buyer has already moved the price up for themselves.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              The result is a more rational incentive structure. Early buyers profit if the token
              grows; they lose if the community loses interest. This aligns early holders with
              long-term success rather than short-term exit liquidity extraction.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Why Bonding Curves Are Better Than Presales for Creators</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              A creator who launches through a bonding curve cannot take presale money — but they also
              do not have to find presale investors, negotiate valuations, sign contracts, or worry
              about investor rights. The community is the only investor, and the market price is the
              only valuation.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              On JetForge, a creator spends approximately 0.025 SOL (Solana account rent) to launch.
              That is the total upfront cost. No legal fees, no VC introductions, no lockup schedules.
              The token is live on Solana mainnet within 60 seconds, and if the community finds it
              interesting, trading begins immediately.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              Creators can optionally buy tokens on the same curve at the same price as everyone else.
              This is transparent — any buy from the creator wallet is visible on-chain — and signals
              genuine conviction rather than free insider allocation.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">JetForge's On-Chain Program</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              JetForge's bonding curve logic is implemented as an Anchor/Rust program deployed on
              Solana mainnet. The program ID is{" "}
              <code className="bg-gray-800 px-1 rounded text-green-400 text-sm">
                7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk
              </code>
              . Anyone can read the program's instructions on Solana Explorer or Solscan without
              trusting JetForge's documentation.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              The source code is open on GitHub under{" "}
              <a
                href="https://github.com/jetforgedev/jetforge"
                className="text-blue-400 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                jetforgedev/jetforge
              </a>
              . Every fee rate, every virtual reserve value, and every graduation threshold is visible
              in the code and enforced by the deployed bytecode — not by JetForge's promises.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              The 1% fee on every buy and sell is split between the JetForge treasury
              (13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW) and protocol operating costs.
              There are no hidden fees, no withdrawal fees, and no fees on Raydium liquidity after
              graduation.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">The Anti-Rug Score</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Even with a bonding curve, a determined bad actor can cause harm — for example, by
              buying a large percentage of supply early to create artificial FOMO before selling.
              JetForge's anti-rug score (0–100) quantifies this risk using three factors:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4 ml-4">
              <li>
                <strong>Creator history:</strong> how many tokens this wallet has previously launched
                and whether any graduated versus abandoned.
              </li>
              <li>
                <strong>Whale concentration:</strong> what percentage of supply is held by the top
                five wallets. Higher concentration means higher dump risk.
              </li>
              <li>
                <strong>Trading patterns:</strong> unusual buy-sell clustering that may indicate
                wash trading or coordinated manipulation.
              </li>
            </ul>
            <p className="text-gray-300 leading-relaxed mb-4">
              A score of 100 means every on-chain signal looks healthy. A score below 30 is a strong
              warning to investigate further before buying. The score is displayed prominently on
              every token page and updates in real time as trading activity changes.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Frequently Asked Questions</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">What is a bonding curve?</h3>
                <p className="text-gray-300 leading-relaxed">
                  A bonding curve is a mathematical formula that automatically calculates a token's
                  price based on its circulating supply. As more tokens are bought, the price rises.
                  As tokens are sold, the price falls. There is no order book, no market maker, and
                  no human intervention — the contract enforces the price curve deterministically
                  on-chain.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">How does a bonding curve prevent rug pulls?</h3>
                <p className="text-gray-300 leading-relaxed">
                  Because the smart contract holds all liquidity and sets the price automatically,
                  the token creator cannot drain liquidity the way they could on a traditional DEX.
                  There are no presale tokens for insiders to dump. Every buyer and seller transacts
                  at the same curve-determined price. JetForge additionally gives every token an
                  anti-rug score (0–100) based on whale concentration and creator history.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">What is the constant-product formula used by JetForge?</h3>
                <p className="text-gray-300 leading-relaxed">
                  JetForge uses k = virtualSol × virtualTokens. At launch, the reserves are seeded
                  with virtual amounts so the curve starts at a low, predictable price. As real SOL
                  enters the pool through buys, the virtual component becomes less significant and
                  the price is driven entirely by real supply and demand.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">What happens when a token graduates?</h3>
                <p className="text-gray-300 leading-relaxed">
                  When a token's bonding curve accumulates 85 SOL, JetForge automatically migrates
                  the token and its liquidity to Raydium. The migration is triggered on-chain by the
                  smart contract, so neither the creator nor JetForge can block or delay it.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Is there a price impact on large buys?</h3>
                <p className="text-gray-300 leading-relaxed">
                  Yes. Because the bonding curve uses a constant-product formula, larger purchases
                  cause greater price impact (slippage). JetForge shows real-time price impact
                  estimates before you confirm any trade.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Can the token creator set a different starting price?</h3>
                <p className="text-gray-300 leading-relaxed">
                  No. JetForge's smart contract uses fixed virtual reserves at launch, so every token
                  starts at the same initial price regardless of who created it. This makes every
                  launch genuinely fair — there are no special pricing deals for the creator.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">What does 'virtual reserves' mean?</h3>
                <p className="text-gray-300 leading-relaxed">
                  Virtual reserves are initial values seeded into the AMM formula that do not
                  correspond to real tokens in the pool — they are used purely to set the starting
                  price point. As real SOL enters the pool through buys, the virtual component
                  becomes less significant and the price is driven entirely by real supply and demand.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">How is JetForge different from pump.fun?</h3>
                <p className="text-gray-300 leading-relaxed">
                  Both platforms use constant-product bonding curves. JetForge charges a flat 1% fee,
                  provides whale alerts, an anti-rug score, and real-time graduation progress that
                  pump.fun lacks. JetForge's open-source Anchor/Rust program can also be independently
                  verified on-chain.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Ready to Launch or Trade?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Now that you understand how bonding curves work, you can participate in JetForge token
              launches with a clear mental model of the price mechanics. Every trade you make moves
              the price by a predictable, calculable amount — no hidden fees, no insider advantages,
              no surprises.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you want to launch a token, the process takes under 60 seconds and costs
              approximately 0.025 SOL. There is no coding required, no presale to organize, and no
              liquidity to provide — the bonding curve handles all of it automatically.
            </p>
            <div className="flex gap-4 mt-6">
              <a
                href="/launch"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Launch a Token
              </a>
              <a
                href="/leaderboard"
                className="border border-gray-600 hover:border-gray-400 text-gray-300 font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Browse Tokens
              </a>
            </div>
          </section>
        </article>
      </main>
    </>
  );
}
