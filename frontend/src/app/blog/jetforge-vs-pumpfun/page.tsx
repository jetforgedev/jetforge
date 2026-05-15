import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "JetForge vs pump.fun — Solana Launchpad Comparison",
  description:
    "Honest side-by-side comparison of JetForge and pump.fun. Compare fees, graduation thresholds, creator earnings, anti-rug tools, chart features, and more to choose the right Solana token launchpad.",
  keywords: [
    "JetForge vs pump.fun",
    "pump.fun alternative",
    "Solana token launchpad comparison",
    "best Solana launchpad",
    "fair launch Solana",
    "bonding curve launchpad",
  ],
  alternates: { canonical: "https://jetforge.io/blog/jetforge-vs-pumpfun" },
  openGraph: {
    type: "article",
    url: "https://jetforge.io/blog/jetforge-vs-pumpfun",
    title: "JetForge vs pump.fun — Which Solana Launchpad Is Better?",
    description:
      "Compare JetForge and pump.fun side-by-side. Fees, graduation thresholds, creator tools, anti-rug features, and chart capabilities.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "JetForge vs pump.fun comparison" }],
    siteName: "JetForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "JetForge vs pump.fun — Honest Comparison",
    description: "Fees, graduation, creator earnings, anti-rug tools. Which Solana launchpad wins?",
    images: ["/og-image.jpg"],
  },
};

const comparisonJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "JetForge vs pump.fun: Which Solana Token Launchpad Should You Use?",
  description:
    "An honest side-by-side comparison of JetForge and pump.fun covering fees, graduation thresholds, creator earnings, anti-rug features, and chart capabilities.",
  url: "https://jetforge.io/blog/jetforge-vs-pumpfun",
  author: { "@type": "Organization", name: "JetForge", url: "https://jetforge.io" },
  publisher: {
    "@type": "Organization",
    name: "JetForge",
    logo: { "@type": "ImageObject", url: "https://jetforge.io/logo.png" },
  },
  datePublished: "2025-05-15",
  dateModified: "2025-05-15",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://jetforge.io/blog/jetforge-vs-pumpfun" },
};

const rows = [
  { feature: "Trading fee",          jetforge: "1% per trade",              pumpfun: "1% per trade" },
  { feature: "Token creation cost",  jetforge: "~0.025 SOL (network rent)", pumpfun: "~0.02 SOL (network rent)" },
  { feature: "Graduation threshold", jetforge: "85 SOL",                    pumpfun: "~69 SOL" },
  { feature: "Creator token alloc",  jetforge: "0% (fair launch)",          pumpfun: "0% (fair launch)" },
  { feature: "Creator earnings",     jetforge: "40% of fees → vault",       pumpfun: "No creator fee share" },
  { feature: "Anti-rug score",       jetforge: "Yes — 0–100 per token",     pumpfun: "No" },
  { feature: "Chart intervals",      jetforge: "1s, 1m, 5m, 15m, 30m, 1h, 1d", pumpfun: "Basic candles" },
  { feature: "Whale alerts",         jetforge: "Yes — real-time",           pumpfun: "No" },
  { feature: "Price alerts",         jetforge: "Yes — market cap target",   pumpfun: "No" },
  { feature: "Buyback & burn",       jetforge: "Yes — 20% of fees",        pumpfun: "No" },
  { feature: "Creator follow",       jetforge: "Yes — follow creators",     pumpfun: "No" },
  { feature: "Token comments",       jetforge: "Yes — live chat",           pumpfun: "Yes" },
  { feature: "Portfolio tracker",    jetforge: "Yes — per wallet",          pumpfun: "No" },
  { feature: "Platform scale",       jetforge: "Growing",                   pumpfun: "Dominant — 100k+ tokens" },
];

export default function ComparisonPage() {
  const esc = (obj: object) =>
    JSON.stringify(obj).replace(/</g, "\u003c").replace(/>/g, "\u003e").replace(/&/g, "\u0026");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: esc(comparisonJsonLd) }} />

      <div className="max-w-3xl mx-auto py-10 px-4 space-y-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/35">
          <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-white/70 transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-white/55">JetForge vs pump.fun</span>
        </nav>

        {/* Hero */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#00ff88] bg-[#00ff8810] border border-[#00ff8825] rounded-full px-2.5 py-1">Comparison</span>
            <span className="text-xs text-white/30">6 min read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            JetForge vs pump.fun: Which Solana Token Launchpad Should You Use?
          </h1>
          <p className="text-white/55 leading-7 text-lg">
            Both platforms let anyone launch a Solana token in seconds. But they make different
            choices on fees, creator tools, and transparency features. Here is an honest
            side-by-side breakdown.
          </p>
        </div>

        {/* TL;DR */}
        <div className="rounded-2xl border border-[#00ff88]/20 bg-[#00ff88]/5 p-5 space-y-2">
          <div className="font-semibold text-[#00ff88] text-sm">TL;DR</div>
          <p className="text-sm text-white/65 leading-6">
            If you want the biggest existing audience and the most tokens to trade, <strong className="text-white">pump.fun</strong> wins on volume.
            If you want real-time analytics, creator earnings, anti-rug scores, and a platform built for
            transparency — <strong className="text-white">JetForge</strong> offers more tools out of the box.
          </p>
        </div>

        {/* Comparison table */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Feature comparison</h2>
          <div className="rounded-2xl border border-white/8 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider w-1/3">Feature</th>
                  <th className="text-left px-4 py-3 text-[#00ff88] font-semibold text-xs uppercase tracking-wider w-1/3">JetForge</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wider w-1/3">pump.fun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map(({ feature, jetforge, pumpfun }) => {
                  const jfWins =
                    (jetforge !== pumpfun) &&
                    !["Platform scale", "Token creation cost", "Trading fee", "Graduation threshold", "Creator token alloc"].includes(feature) &&
                    pumpfun === "No";
                  return (
                    <tr key={feature} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-white/50">{feature}</td>
                      <td className={`px-4 py-3 font-medium ${jfWins ? "text-[#00ff88]" : "text-white/80"}`}>{jetforge}</td>
                      <td className={`px-4 py-3 ${pumpfun === "No" ? "text-white/30" : "text-white/65"}`}>{pumpfun}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-white/30">
            pump.fun data based on publicly available information as of May 2025. Features may change.
          </p>
        </section>

        {/* Deep dive sections */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Fees: identical on the surface, different underneath</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              Both platforms charge 1% per trade. But what happens to those fees is very different.
            </p>
            <p>
              On JetForge, the 1% fee is split three ways: <strong className="text-white">40% goes into a creator vault</strong> —
              withdrawable by the token creator at any time — 20% goes into a per-token buyback-and-burn vault
              that automatically burns tokens when it hits a threshold, and 40% goes to the platform treasury.
            </p>
            <p>
              This means if you launch a token on JetForge and it does 10 SOL of volume, you earn
              0.04 SOL as the creator — automatically, with no additional steps. Pump.fun does not
              have a creator fee-sharing mechanism.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Anti-rug score: the transparency difference</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              JetForge calculates an anti-rug score (0–100) for every token based on four factors:
              creator history (previous launches, graduation rate, early-sell patterns), whale
              concentration (top-10 wallet holdings), creator sell activity, and time-weighted volume consistency.
            </p>
            <p>
              A score above 70 indicates lower apparent rug risk. This gives traders a quantified
              signal before they buy — rather than having to manually check wallets on an explorer.
              Pump.fun does not provide this feature.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Charts: more intervals, more data</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              JetForge provides OHLCV candlestick charts at seven intervals: 1 second, 1 minute,
              5 minutes, 15 minutes, 30 minutes, 1 hour, and 1 day. All historical trade data is
              retained with no expiry. The chart includes real-time price updates via WebSocket.
            </p>
            <p>
              Active traders who want to analyse price action in detail will find JetForge provides
              more charting flexibility than basic launchpad interfaces.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Graduation: 85 SOL vs ~69 SOL</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              JetForge tokens graduate to Raydium when they accumulate <strong className="text-white">85 SOL</strong> in
              the bonding curve. Pump.fun graduates at approximately <strong className="text-white">69 SOL</strong>.
              The higher threshold on JetForge means tokens need stronger community traction before
              graduating — which tends to filter out tokens that spike and die within minutes.
            </p>
            <p>
              At graduation, the bonding curve closes automatically, the SOL reserve and a proportional
              token allocation seed a Raydium liquidity pool, and open-market trading begins.
              The entire process is governed by the on-chain smart contract — JetForge cannot
              intervene or redirect funds.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Which platform should you choose?</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p><strong className="text-white">Choose pump.fun if:</strong> you want to trade the highest volume of tokens,
            you prefer the most established platform in the Solana meme coin ecosystem, or you are
            looking for the largest existing audience of buyers.</p>
            <p><strong className="text-white">Choose JetForge if:</strong> you are a token creator who wants to earn
            a share of trading fees, you want anti-rug transparency tools before buying, you want
            advanced chart intervals and real-time whale alerts, or you prefer a platform with
            verifiable on-chain contract addresses.</p>
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-[#00ff88]/20 bg-[#00ff88]/5 p-6 text-center space-y-4">
          <div className="text-white font-bold text-lg">Ready to launch on JetForge?</div>
          <p className="text-sm text-white/55">Create your token in under 60 seconds. No coding required. Fair launch, bonding curve, auto-graduation to Raydium.</p>
          <Link
            href="/launch"
            className="inline-flex items-center gap-2 bg-[#00ff88] text-black font-bold px-6 py-3 rounded-xl hover:bg-[#00dd77] transition-colors text-sm"
          >
            🚀 Launch a Token
          </Link>
        </div>

        {/* Related */}
        <div className="border-t border-white/8 pt-8 space-y-3">
          <div className="text-xs text-white/30 uppercase tracking-widest">Related</div>
          <Link href="/blog/how-to-launch-a-token-on-solana" className="block text-[#00ff88] hover:underline text-sm">
            How to Launch a Token on Solana in Under 60 Seconds →
          </Link>
          <Link href="/faq" className="block text-white/50 hover:text-white text-sm transition-colors">
            JetForge FAQ →
          </Link>
        </div>

      </div>
    </>
  );
}
