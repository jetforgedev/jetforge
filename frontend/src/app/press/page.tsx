import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Press Kit — JetForge",
  description:
    "Media kit for JetForge — the fair-launch bonding curve token launchpad on Solana. Logos, brand assets, factsheet, and press contacts.",
  alternates: { canonical: "https://jetforge.io/press" },
  openGraph: {
    title: "Press Kit — JetForge",
    description:
      "Brand assets, factsheet, and press contacts for JetForge — Solana's fair-launch token launchpad.",
    url: "https://jetforge.io/press",
    siteName: "JetForge",
    images: [{ url: "https://app.jetforge.io/og", width: 1200, height: 630 }],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "JetForge Press Kit",
  url: "https://jetforge.io/press",
  description:
    "Media kit for JetForge — the fair-launch bonding curve token launchpad on Solana.",
  publisher: {
    "@type": "Organization",
    name: "JetForge",
    url: "https://jetforge.io",
    logo: { "@type": "ImageObject", url: "https://jetforge.io/logo.png" },
    sameAs: [
      "https://twitter.com/JetForgeIO",
      "https://github.com/jetforgeio",
    ],
  },
};

export default function PressPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-[#0f0f1a] text-white">
        <div className="max-w-4xl mx-auto px-6 py-20">

          {/* Header */}
          <div className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm mb-6">
              📰 Media Kit
            </div>
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              JetForge <span className="text-indigo-400">Press Kit</span>
            </h1>
            <p className="text-gray-400 text-xl leading-relaxed max-w-2xl">
              Everything journalists, analysts, and content creators need to cover JetForge —
              the fair-launch bonding curve launchpad on Solana.
            </p>
          </div>

          {/* Quick facts */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-white">Quick Facts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Full name", value: "JetForge" },
                { label: "Category", value: "Decentralized Token Launchpad / DEX" },
                { label: "Blockchain", value: "Solana" },
                { label: "Launch year", value: "2025" },
                { label: "Graduation threshold", value: "85 SOL market cap → Raydium" },
                { label: "Trading fee", value: "1% per trade on bonding curve" },
                { label: "Token presales", value: "None — fair launch only" },
                { label: "Team allocations", value: "None" },
                {
                  label: "On-chain program",
                  value: "7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk",
                },
                { label: "Website", value: "https://jetforge.io" },
                { label: "App", value: "https://app.jetforge.io" },
                { label: "Twitter / X", value: "@JetForgeIO" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col gap-1 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <span className="text-xs uppercase tracking-widest text-gray-500">{label}</span>
                  <span className="text-white font-medium break-all">{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* About */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-white">About JetForge</h2>
            <div className="prose prose-invert max-w-none space-y-4 text-gray-300 leading-relaxed text-lg">
              <p>
                JetForge is a fair-launch token launchpad and decentralized exchange built on Solana.
                It allows anyone to create and trade meme tokens instantly, with no presales, no private
                sales, and no team token allocations — ensuring every participant starts on equal footing.
              </p>
              <p>
                Tokens trade on an automated bonding curve using a constant-product AMM. As buying
                pressure grows, the price rises predictably along the curve. When a token reaches
                85 SOL in market capitalization, it automatically graduates to Raydium — Solana&apos;s
                leading decentralized exchange — giving it access to deeper liquidity and broader exposure.
              </p>
              <p>
                JetForge features real-time price charts with multiple time intervals (1m, 5m, 15m, 1h, 4h),
                live trade feeds with whale alerts, creator leaderboards, and a portfolio tracker with
                unrealized and realized PnL calculations. The platform is fully non-custodial — users
                connect their Solana wallets and retain full control of their assets at all times.
              </p>
            </div>
          </section>

          {/* Key differentiators */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-white">Key Differentiators</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  icon: "⚖️",
                  title: "True Fair Launch",
                  desc: "No presales, no team allocations, no VC rounds. Every token starts equally for all participants.",
                },
                {
                  icon: "📈",
                  title: "Advanced Charting",
                  desc: "Multiple candlestick intervals (1m through 4h), volume bars, and real-time WebSocket updates.",
                },
                {
                  icon: "🐋",
                  title: "Whale Alerts",
                  desc: "Real-time notifications when large trades occur, giving traders market intelligence.",
                },
                {
                  icon: "🎯",
                  title: "Auto-Graduation",
                  desc: "Tokens automatically bridge to Raydium at 85 SOL market cap — no manual intervention needed.",
                },
                {
                  icon: "🏆",
                  title: "Creator Leaderboards",
                  desc: "Creators compete for visibility based on volume, trades, and graduated tokens.",
                },
                {
                  icon: "💼",
                  title: "Portfolio Tracker",
                  desc: "Full PnL tracking with cost basis, unrealized gains, and realized profit per token.",
                },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="p-5 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-2xl mb-3">{icon}</div>
                  <h3 className="font-semibold text-white mb-2">{title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Brand assets */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-white">Brand Assets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Primary Logo (PNG)", href: "/logo.png", note: "Transparent background" },
                { label: "OG / Social Image", href: "/og-image.png", note: "1200×630px" },
                {
                  label: "CoinGecko Listing",
                  href: "https://www.coingecko.com/en/exchanges/jetforge",
                  note: "Exchange profile (pending approval)",
                  external: true,
                },
                {
                  label: "Solana Explorer",
                  href: "https://explorer.solana.com/address/7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk",
                  note: "On-chain program verification",
                  external: true,
                },
              ].map(({ label, href, note, external }) => (
                <a
                  key={label}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/40 hover:bg-white/8 transition-all group"
                >
                  <div>
                    <div className="text-white font-medium group-hover:text-indigo-400 transition-colors">{label}</div>
                    <div className="text-gray-500 text-sm">{note}</div>
                  </div>
                  <span className="text-gray-500 group-hover:text-indigo-400 transition-colors">↗</span>
                </a>
              ))}
            </div>
          </section>

          {/* Boilerplate */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-white">Approved Boilerplate</h2>
            <div className="space-y-6">
              {[
                {
                  label: "Short (one line)",
                  text: "JetForge is a fair-launch bonding curve token launchpad on Solana with automatic Raydium graduation.",
                },
                {
                  label: "Medium (two sentences)",
                  text: "JetForge is a decentralized token launchpad on Solana built on a fair-launch bonding curve model — no presales, no team allocations. Tokens trade on an automated AMM curve and graduate to Raydium DEX at 85 SOL market capitalization.",
                },
                {
                  label: "Long (press paragraph)",
                  text: "JetForge is a fair-launch bonding curve launchpad and decentralized exchange on Solana. Anyone can create a token instantly with zero upfront cost — there are no presales, private rounds, or team allocations. All tokens trade on a constant-product AMM bonding curve, and automatically graduate to Raydium liquidity pools at 85 SOL market cap. The platform features real-time charts, whale alerts, creator leaderboards, and a full portfolio tracker. JetForge is fully non-custodial and open to anyone with a Solana wallet.",
                },
              ].map(({ label, text }) => (
                <div key={label} className="p-5 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">{label}</div>
                  <p className="text-gray-300 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Press contact */}
          <section>
            <h2 className="text-2xl font-bold mb-6 text-white">Press Contact</h2>
            <div className="p-6 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <p className="text-gray-300 mb-4">
                For press inquiries, interview requests, partnership opportunities, or listing questions:
              </p>
              <a
                href="mailto:itsdrsmith013@gmail.com"
                className="text-indigo-400 hover:text-indigo-300 font-medium text-lg transition-colors"
              >
                itsdrsmith013@gmail.com
              </a>
              <div className="mt-4 flex gap-4">
                <a
                  href="https://twitter.com/JetForgeIO"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  Twitter / X ↗
                </a>
              </div>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
