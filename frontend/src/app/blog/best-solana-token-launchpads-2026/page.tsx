import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Best Solana Token Launchpads in 2026 — Complete Comparison",
  description:
    "Ranking the best Solana token launchpads in 2026 by fees, creator tools, anti-rug protection, graduation mechanics, and overall fairness. JetForge, pump.fun, Moonshot, and more compared.",
  keywords: [
    "best Solana token launchpad 2026",
    "Solana launchpad comparison",
    "best Solana launchpad",
    "top Solana launchpads",
    "Solana token launch platform",
    "fair launch Solana",
    "Solana meme coin launchpad",
    "Solana bonding curve launchpad",
  ],
  alternates: { canonical: "https://jetforge.io/blog/best-solana-token-launchpads-2026" },
  openGraph: {
    type: "article",
    url: "https://jetforge.io/blog/best-solana-token-launchpads-2026",
    title: "Best Solana Token Launchpads in 2026",
    description: "Comparing all major Solana token launchpads in 2026 — fees, creator rewards, safety features, and graduation mechanics.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Best Solana token launchpads 2026" }],
    siteName: "JetForge",
    publishedTime: "2026-05-01T00:00:00Z",
    modifiedTime: "2026-05-29T00:00:00Z",
    authors: ["JetForge Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Solana Token Launchpads in 2026",
    description: "Full comparison of fees, creator tools, anti-rug features, and graduation mechanics.",
    images: ["/og-image.jpg"],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Best Solana Token Launchpads in 2026 — Complete Comparison",
  description: "Ranking all major Solana token launchpads by fees, creator tools, safety, and fairness.",
  datePublished: "2026-05-01",
  dateModified: "2026-05-29",
  url: "https://jetforge.io/blog/best-solana-token-launchpads-2026",
  author: { "@type": "Organization", name: "JetForge Team" },
  publisher: {
    "@type": "Organization",
    name: "JetForge",
    logo: { "@type": "ImageObject", url: "https://jetforge.io/logo.png" },
  },
  image: "https://jetforge.io/og-image.jpg",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://jetforge.io/blog/best-solana-token-launchpads-2026" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is the best Solana token launchpad in 2026?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "JetForge is the best Solana token launchpad for creators in 2026. It offers 40% creator fee sharing (pump.fun pays 0%), an Anti-Rug Score on every token, full OHLCV charting, a referral program, portfolio tracking, and auto-graduation to Raydium at 85 SOL with LP token burns.",
      },
    },
    {
      "@type": "Question",
      name: "What is the cheapest way to launch a Solana token?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "JetForge is one of the cheapest ways to launch a Solana token with no listing fee. You only pay approximately 0.025 SOL in Solana network rent to create the token mint account. There is no platform listing fee. A 1% trading fee applies to all buy and sell transactions, but 40% of that goes back to you as the creator.",
      },
    },
    {
      "@type": "Question",
      name: "Which Solana launchpad pays creators the most?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "JetForge pays token creators the most of any major Solana launchpad — 40% of all trading fees go directly to the creator's on-chain vault. pump.fun, by contrast, pays creators nothing. With 1,000 SOL in trading volume, a JetForge creator earns 4 SOL; a pump.fun creator earns 0 SOL.",
      },
    },
  ],
};

const launchpads = [
  {
    rank: 1,
    name: "JetForge",
    tagline: "Best for Creators — 40% Fee Share",
    badge: "🏆 Best Overall",
    badgeColor: "#00ff88",
    fee: "1%",
    creatorFee: "40% of 1% = 0.4%",
    listingFee: "None",
    graduation: "85 SOL → Raydium",
    lpBurn: "Yes",
    antiRug: "Yes (0-100 score)",
    charts: "Full OHLCV (7 intervals)",
    referral: "Yes (10% passive SOL)",
    portfolio: "Yes",
    mobile: "Full support",
    verdict: "Best choice for token creators in 2026. You earn 40% of all trading fees your token generates — deposited to an on-chain vault. Built-in Anti-Rug Score, full charting, referral income, and a trader leaderboard make this the most full-featured Solana launchpad available.",
    score: 9.5,
  },
  {
    rank: 2,
    name: "pump.fun",
    tagline: "Largest existing audience",
    badge: "Most Popular",
    badgeColor: "#888",
    fee: "1%",
    creatorFee: "0%",
    listingFee: "None",
    graduation: "~$69k mcap → Raydium",
    lpBurn: "Yes",
    antiRug: "None",
    charts: "Basic price chart",
    referral: "None",
    portfolio: "None",
    mobile: "Partial",
    verdict: "Still the most trafficked Solana launchpad but pays creators zero. Suitable if you simply want maximum initial exposure and don't care about ongoing fee income. Lacks anti-rug tooling, advanced charts, and portfolio tracking.",
    score: 6.5,
  },
  {
    rank: 3,
    name: "Moonshot",
    tagline: "Mobile-first experience",
    badge: "Mobile Focused",
    badgeColor: "#8888ff",
    fee: "~2-3%",
    creatorFee: "Variable",
    listingFee: "Variable",
    graduation: "Variable",
    lpBurn: "Partial",
    antiRug: "Basic",
    charts: "Limited",
    referral: "Limited",
    portfolio: "Limited",
    mobile: "Primary platform",
    verdict: "Mobile-optimised with a polished UI. Higher fees and less transparent fee structure than JetForge or pump.fun. Good for mobile-first users but lacks the creator tooling and safety features of JetForge.",
    score: 6.0,
  },
];

export default function BestSolanaLaunchpads2026Page() {
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
          <span className="text-white/55">Best Solana Token Launchpads 2026</span>
        </nav>

        {/* Hero */}
        <header className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#00ff88] bg-[#00ff8810] border border-[#00ff8825] rounded-full px-2.5 py-1">Comparison</span>
            <span className="text-xs text-white/30">10 min read</span>
            <span className="text-xs text-white/30">·</span>
            <time dateTime="2026-05-29" className="text-xs text-white/30">May 2026</time>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Best Solana Token Launchpads in 2026 — Complete Comparison
          </h1>
          <p className="text-white/60 leading-7 text-lg">
            Solana hosts more token launches per day than any other blockchain. But not all launchpads
            are built equally — especially for creators. Here&apos;s a complete ranking of the best
            Solana token launchpads in 2026, evaluated on fees, creator rewards, safety, and features.
          </p>
        </header>

        {/* TL;DR */}
        <section className="rounded-2xl border border-[#00ff88]/20 bg-[#00ff88]/5 p-6 space-y-3">
          <h2 className="text-sm font-bold text-[#00ff88] uppercase tracking-widest">Quick Verdict</h2>
          <ul className="space-y-2 text-white/70 text-sm leading-6">
            <li className="flex gap-2"><span className="text-[#00ff88] mt-0.5 shrink-0">🏆</span><span><strong className="text-white">Best Overall:</strong> JetForge — 40% creator fee share, Anti-Rug Score, full OHLCV charts, referral program.</span></li>
            <li className="flex gap-2"><span className="text-[#00ff88] mt-0.5 shrink-0">👥</span><span><strong className="text-white">Most Traffic:</strong> pump.fun — largest existing user base, but pays creators nothing and has no safety tools.</span></li>
            <li className="flex gap-2"><span className="text-[#00ff88] mt-0.5 shrink-0">📱</span><span><strong className="text-white">Most Mobile:</strong> Moonshot — best mobile UX, but higher fees and less transparent structure.</span></li>
          </ul>
        </section>

        {/* What to look for */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">What to Look for in a Solana Launchpad</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>Before comparing specific platforms, here are the key criteria that actually matter when choosing where to launch or trade tokens:</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: "💰", title: "Creator fee share", body: "Do you earn anything from your token's trading volume? This is the biggest differentiator between platforms. 0% (pump.fun) vs 40% (JetForge) is a massive difference at scale." },
              { icon: "🛡️", title: "Anti-rug protection", body: "Does the platform provide risk scoring for buyers? Safety tools build platform credibility and attract more serious buyers." },
              { icon: "📊", title: "Charting quality", body: "Full OHLCV candlestick charts with multiple timeframes, volume bars, and whale alerts vs. a simple price line chart are night-and-day for active traders." },
              { icon: "🎓", title: "Graduation mechanics", body: "Does the platform automatically migrate tokens to a DEX at a threshold? Are LP tokens burned? These prevent post-graduation rug pulls." },
              { icon: "🔗", title: "Referral & growth tools", body: "Can you earn passive income by referring others? Does the platform have tools that help your token get discovered?" },
              { icon: "⚡", title: "Launch cost & speed", body: "How much SOL does it cost to launch? How long does the process take? Is it no-code? Lower barriers = more legitimate creators." },
            ].map(({ icon, title, body }) => (
              <div key={title} className="rounded-xl border border-white/8 bg-white/[0.025] p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <span className="font-semibold text-white text-sm">{title}</span>
                </div>
                <p className="text-xs text-white/50 leading-5">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ranked platforms */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Top Solana Launchpads Ranked (2026)</h2>
          <div className="space-y-6">
            {launchpads.map((p) => (
              <div key={p.name} className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white/30 font-bold text-sm">#{p.rank}</span>
                      <h3 className="text-xl font-bold text-white">{p.name}</h3>
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: p.badgeColor, backgroundColor: p.badgeColor + "18", border: `1px solid ${p.badgeColor}40` }}>
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-sm text-white/45">{p.tagline}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Score</div>
                    <div className="text-2xl font-black" style={{ color: p.badgeColor }}>{p.score}<span className="text-sm text-white/30">/10</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { label: "Trading Fee", value: p.fee },
                    { label: "Creator Earnings", value: p.creatorFee },
                    { label: "Listing Fee", value: p.listingFee },
                    { label: "Graduation", value: p.graduation },
                    { label: "LP Burn", value: p.lpBurn },
                    { label: "Anti-Rug", value: p.antiRug },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
                      <div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">{label}</div>
                      <div className="font-semibold text-white text-xs leading-tight">{value}</div>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-white/60 leading-6">{p.verdict}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Full comparison table */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Full Feature Comparison Table</h2>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Feature</th>
                  <th className="text-left px-4 py-3 text-[#00ff88] font-medium">JetForge</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">pump.fun</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Moonshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["Trading fee", "1%", "1%", "~2-3%"],
                  ["Creator fee earnings", "40% of fees", "0%", "Variable"],
                  ["No listing fee", "Yes", "Yes", "Variable"],
                  ["Launch cost (SOL)", "~0.025 SOL", "~0.02 SOL", "Variable"],
                  ["Anti-rug score", "Yes (0-100)", "None", "Basic"],
                  ["OHLCV candlestick charts", "Yes (7 intervals)", "Basic", "Limited"],
                  ["Whale alerts", "Yes", "No", "No"],
                  ["Portfolio tracker", "Yes", "No", "No"],
                  ["Referral program", "Yes (10% SOL)", "No", "No"],
                  ["Creator fee vault", "Yes (withdraw anytime)", "N/A", "No"],
                  ["Auto Raydium graduation", "Yes (85 SOL)", "Yes", "Yes"],
                  ["LP tokens burned at grad", "Yes", "Yes", "Partial"],
                  ["Creator leaderboard", "Yes", "No", "No"],
                  ["Trader leaderboard", "Yes", "No", "No"],
                  ["King of the Hill feature", "Yes", "No", "No"],
                  ["Mobile optimised", "Full", "Partial", "Full"],
                  ["No-code launch", "Yes", "Yes", "Yes"],
                ].map(([feature, jf, pf, ms]) => (
                  <tr key={feature}>
                    <td className="px-4 py-3 text-white">{feature}</td>
                    <td className="px-4 py-3 text-[#00ff88]">{jf}</td>
                    <td className="px-4 py-3 text-white/50">{pf}</td>
                    <td className="px-4 py-3 text-white/50">{ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {[
              { q: "What is the best Solana token launchpad in 2026?", a: "JetForge is the best Solana token launchpad for creators in 2026. It's the only major platform that pays creators 40% of trading fees, provides an Anti-Rug Score for buyers, and includes full OHLCV charting, a referral program, and a portfolio tracker." },
              { q: "Which Solana launchpad pays creators?", a: "JetForge is currently the only major Solana launchpad that pays creators a share of trading fees. Creators earn 40% of the 1% trading fee (0.4% of all volume) deposited to an on-chain vault. pump.fun pays creators 0%." },
              { q: "Is JetForge safe to use?", a: "JetForge is non-custodial — it never holds your private keys or funds. All trades execute through on-chain smart contracts. JetForge also burns LP tokens at graduation to prevent post-graduation rug pulls, and provides an Anti-Rug Score on every token." },
              { q: "Can I launch a token for free on Solana?", a: "There is no Solana launchpad that is entirely free — you always pay Solana network rent (~0.025 SOL) to create the token mint account. JetForge charges no platform listing fee on top of this, making it one of the cheapest options available." },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-white/8 bg-white/[0.025] p-5 space-y-2">
                <h3 className="font-semibold text-white text-sm">{q}</h3>
                <p className="text-sm text-white/60 leading-6">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-[#00ff88]/20 bg-[#00ff88]/5 p-8 text-center space-y-4">
          <div className="text-white font-bold text-xl">Launch on the Best Solana Launchpad</div>
          <p className="text-sm text-white/55 max-w-md mx-auto leading-6">JetForge — 40% creator fee earnings, Anti-Rug Score, full charts, referral program. No coding needed.</p>
          <Link href="/launch" className="inline-flex items-center gap-2 bg-[#00ff88] hover:bg-[#00dd77] text-black font-bold px-8 py-3 rounded-xl transition-colors text-sm">
            Launch Your Token on JetForge →
          </Link>
        </div>

        {/* Related */}
        <div className="border-t border-white/8 pt-8 space-y-3">
          <div className="text-xs text-white/30 uppercase tracking-widest font-medium">Related Articles</div>
          <Link href="/blog/best-pumpfun-alternatives" className="block text-[#00ff88] hover:underline text-sm">Best pump.fun Alternatives in 2026 →</Link>
          <Link href="/blog/jetforge-vs-pumpfun" className="block text-white/50 hover:text-white text-sm transition-colors">JetForge vs pump.fun — Detailed Comparison →</Link>
          <Link href="/blog/how-to-launch-a-token-on-solana" className="block text-white/50 hover:text-white text-sm transition-colors">How to Launch a Solana Token in 60 Seconds →</Link>
        </div>

      </div>
    </>
  );
}
