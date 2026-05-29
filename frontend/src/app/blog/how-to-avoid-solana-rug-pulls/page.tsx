import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "How to Avoid Solana Rug Pulls — Token Safety Guide 2026",
  description:
    "Learn how to spot and avoid Solana rug pulls in 2026. Red flags to check before buying any meme coin: whale concentration, social links, creator history, LP lock status, and anti-rug scores.",
  keywords: [
    "Solana rug pull",
    "how to avoid rug pull",
    "solana token safety",
    "rug pull warning signs",
    "solana meme coin scam",
    "how to spot rug pull solana",
    "anti-rug score",
    "safe solana tokens 2026",
  ],
  alternates: { canonical: "https://jetforge.io/blog/how-to-avoid-solana-rug-pulls" },
  openGraph: {
    type: "article",
    url: "https://jetforge.io/blog/how-to-avoid-solana-rug-pulls",
    title: "How to Avoid Solana Rug Pulls — Token Safety Guide 2026",
    description: "Red flags, warning signs, and tools to protect yourself from Solana rug pulls and meme coin scams.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "How to avoid Solana rug pulls" }],
    siteName: "JetForge",
    publishedTime: "2026-05-01T00:00:00Z",
    modifiedTime: "2026-05-29T00:00:00Z",
    authors: ["JetForge Team"],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Avoid Solana Rug Pulls (2026 Guide)",
    description: "Red flags, warning signs, and safety tools — before you buy any Solana meme coin.",
    images: ["/og-image.jpg"],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Avoid Solana Rug Pulls — Token Safety Guide 2026",
  description: "Red flags, warning signs, and tools to spot and avoid Solana rug pulls.",
  datePublished: "2026-05-01",
  dateModified: "2026-05-29",
  url: "https://jetforge.io/blog/how-to-avoid-solana-rug-pulls",
  author: { "@type": "Organization", name: "JetForge Team" },
  publisher: {
    "@type": "Organization",
    name: "JetForge",
    logo: { "@type": "ImageObject", url: "https://jetforge.io/logo.png" },
  },
  image: "https://jetforge.io/og-image.jpg",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://jetforge.io/blog/how-to-avoid-solana-rug-pulls" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a rug pull in Solana?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A Solana rug pull is when token developers or large holders sell their entire position suddenly, crashing the price to near zero and leaving other buyers with worthless tokens. It can also involve developers draining a liquidity pool they control.",
      },
    },
    {
      "@type": "Question",
      name: "How do I check if a Solana token is safe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Check the top holder concentration (less than 20% in any single wallet is safer), verify the creator's wallet has a track record of legitimate launches, confirm social links are active and real, and use platforms like JetForge that provide an Anti-Rug Score (0-100) on every token.",
      },
    },
    {
      "@type": "Question",
      name: "Can you get rugged on a bonding curve?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A bonding curve AMM is structurally harder to rug pull than a traditional liquidity pool because there is no single liquidity pool the developer can drain. However, large early buyers (whales) can still dump their position, causing a significant price drop. Bonding curves do not eliminate risk — they reduce one specific attack vector.",
      },
    },
  ],
};

const redFlags = [
  {
    icon: "🐋",
    title: "High Whale Concentration",
    severity: "Critical",
    severityColor: "#ff4444",
    body: "If the top 5 wallets hold more than 50% of the supply, a single sell event can crater the price. Check the holder distribution on JetForge's token page. On JetForge, tokens with high whale concentration score lower on the Anti-Rug Score automatically.",
    tip: "Safe threshold: no single wallet holding more than 10-15% of supply.",
  },
  {
    icon: "👻",
    title: "No Social Links or Community",
    severity: "High",
    severityColor: "#ff8800",
    body: "A token with zero Twitter, Telegram, or website links is anonymous by design. While not all anonymous tokens rug, legitimate projects almost always have some community presence — even a simple Telegram group shows intent to build.",
    tip: "Verify the social accounts are active and have real followers, not bots.",
  },
  {
    icon: "🆕",
    title: "New Creator Wallet with No History",
    severity: "High",
    severityColor: "#ff8800",
    body: "A creator wallet that was funded hours ago with no prior on-chain activity is a warning sign. Rug pullers often create fresh wallets specifically to avoid having their history tracked. Established creators with multiple previous launches are lower risk.",
    tip: "Check the creator profile on JetForge — it shows all tokens launched by that wallet and their outcomes.",
  },
  {
    icon: "💨",
    title: "Suspiciously Fast Price Pumps",
    severity: "Medium",
    severityColor: "#ffcc00",
    body: "If a token's price doubles or triples within minutes of launch before any organic community has formed, it is often coordinated buy pressure designed to attract FOMO buyers before a dump. Organic growth is steadier.",
    tip: "Compare buy wallet count vs. buy volume. One wallet doing 80% of the buys is a red flag.",
  },
  {
    icon: "📋",
    title: "Plagiarised or Copied Description",
    severity: "Medium",
    severityColor: "#ffcc00",
    body: "Copy-pasted descriptions from other tokens, or extremely vague promises with no substance, are common in low-effort rug setups. A genuine project can explain what it is and why it exists.",
    tip: "Search the first sentence of the description — if it appears on 10 other tokens, be cautious.",
  },
  {
    icon: "🔒",
    title: "No LP Token Burn at Graduation",
    severity: "Critical",
    severityColor: "#ff4444",
    body: "On platforms where LP tokens are not burned at graduation, developers could theoretically drain the Raydium liquidity pool after graduation. JetForge burns LP tokens automatically at the 85 SOL graduation threshold — this removes this attack vector entirely.",
    tip: "Always confirm whether the platform you use burns LP tokens at graduation.",
  },
];

export default function HowToAvoidRugPullsPage() {
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
          <span className="text-white/55">How to Avoid Solana Rug Pulls</span>
        </nav>

        {/* Hero */}
        <header className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2.5 py-1">Safety Guide</span>
            <span className="text-xs text-white/30">9 min read</span>
            <span className="text-xs text-white/30">·</span>
            <time dateTime="2026-05-29" className="text-xs text-white/30">May 2026</time>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            How to Avoid Solana Rug Pulls — Complete Safety Guide (2026)
          </h1>
          <p className="text-white/60 leading-7 text-lg">
            Rug pulls are the most common way traders lose money on Solana meme coins. This guide covers
            the exact red flags to check before buying any new token — and the tools that make it easier.
          </p>
        </header>

        {/* TL;DR */}
        <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-3">
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-widest">Quick Safety Checklist</h2>
          <ul className="space-y-2 text-white/70 text-sm leading-6">
            {[
              "No single wallet holds more than 15% of the supply",
              "Creator wallet has a history of legitimate launches",
              "Active social links (Twitter, Telegram) with real community",
              "LP tokens burned at graduation (prevents pool drain)",
              "Price growth is organic — not one wallet doing all the buying",
              "Token description is original, not copy-pasted",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[#00ff88] mt-0.5 shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* What is a rug pull */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">What Is a Solana Rug Pull?</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              A rug pull is when the developers or large early holders of a token suddenly sell all their
              holdings in a coordinated move, crashing the price to near zero. The name comes from the phrase
              &quot;pulling the rug out from under someone.&quot;
            </p>
            <p>There are two main types on Solana:</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
                <div className="font-semibold text-white text-sm">Hard Rug Pull</div>
                <p className="text-xs text-white/55 leading-5">Developer drains the entire liquidity pool or sells a massive dev allocation in a single transaction. Token price drops 90-100% instantly. Most common on unaudited contracts with no LP lock.</p>
              </div>
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-2">
                <div className="font-semibold text-white text-sm">Soft Rug Pull (Slow Dump)</div>
                <p className="text-xs text-white/55 leading-5">Early buyers or the creator gradually sell their position over days or weeks, slowly bleeding the price down while retail buyers continue to FOMO in. Harder to detect in real time.</p>
              </div>
            </div>
            <p>
              <strong className="text-white">Bonding curve platforms are harder to hard rug</strong> because
              there is no developer-controlled liquidity pool before graduation. However, soft rugs (whale dumps)
              still occur on all platforms.
            </p>
          </div>
        </section>

        {/* Red flags */}
        <section className="space-y-5">
          <h2 className="text-2xl font-bold text-white">6 Red Flags to Check Before Buying</h2>
          <div className="space-y-4">
            {redFlags.map(({ icon, title, severity, severityColor, body, tip }) => (
              <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-2xl">{icon}</span>
                  <h3 className="font-bold text-white">{title}</h3>
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: severityColor, backgroundColor: severityColor + "18", border: `1px solid ${severityColor}40` }}>
                    {severity} Risk
                  </span>
                </div>
                <p className="text-sm text-white/60 leading-6">{body}</p>
                <div className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 text-xs text-[#00ff88]">
                  💡 {tip}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Anti-Rug Score */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">JetForge's Anti-Rug Score — Automated Safety Signals</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              JetForge automatically calculates an <strong className="text-white">Anti-Rug Score (0–100)</strong> for
              every token on the platform. A higher score means lower perceived risk. The score is displayed
              prominently on each token page so buyers can instantly assess safety without manual research.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { range: "80–100", label: "Low Risk", color: "#00ff88", desc: "Creator has strong history, diversified holders, active social links, organic trading patterns." },
                { range: "60–79", label: "Moderate Risk", color: "#88ff44", desc: "Some positive signals but missing social presence or modest holder concentration." },
                { range: "40–59", label: "Elevated Risk", color: "#ffcc00", desc: "New creator wallet, limited social links, or above-average holder concentration." },
                { range: "0–39", label: "High Risk", color: "#ff4444", desc: "Multiple red flags: anonymous creator, high whale concentration, suspicious trading patterns." },
              ].map(({ range, label, color, desc }) => (
                <div key={range} className="rounded-xl border border-white/8 bg-white/[0.025] p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color }}>{range}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest rounded-full px-2 py-0.5" style={{ color, backgroundColor: color + "18" }}>{label}</span>
                  </div>
                  <p className="text-xs text-white/50 leading-5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Safe trading practices */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Safe Trading Practices</h2>
          <div className="space-y-3">
            {[
              { n: "01", title: "Never invest more than you can afford to lose completely", body: "All meme coins are high-risk speculative assets. Even tokens that pass every safety check can fail. Only put in money you are entirely comfortable losing." },
              { n: "02", title: "Check the holder list before buying", body: "Click the 'Holders' tab on any JetForge token page to see the full wallet distribution. If the top 3 wallets hold 60%+ of supply combined, the rug risk is significant." },
              { n: "03", title: "Watch the first 10 minutes closely", body: "Most rug pulls happen within the first 10-30 minutes of launch when victims are still FOMO-ing in. If price action looks unnatural (perfectly vertical spike with one buyer wallet), wait and observe." },
              { n: "04", title: "Verify social links are real, not just created", body: "Rug pullers often create Twitter accounts minutes before launch with zero followers. A 3-day-old account with 12 followers is not the same as an established community." },
              { n: "05", title: "Use platforms with LP burn at graduation", body: "When a token graduates to Raydium, make sure the LP tokens are burned. JetForge burns LP tokens automatically at the 85 SOL graduation threshold — this prevents developers from draining the Raydium pool post-graduation." },
            ].map(({ n, title, body }) => (
              <div key={n} className="rounded-xl border border-white/8 bg-white/[0.025] p-5 flex gap-4">
                <div className="text-2xl font-black text-white/10 leading-none mt-0.5 shrink-0 w-8">{n}</div>
                <div className="space-y-1">
                  <div className="font-semibold text-white text-sm">{title}</div>
                  <p className="text-sm text-white/55 leading-6">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">FAQ: Solana Rug Pull Safety</h2>
          <div className="space-y-3">
            {[
              {
                q: "What is a rug pull in Solana?",
                a: "A Solana rug pull is when token developers or large holders sell their entire position suddenly, crashing the price to near zero. It can also involve developers draining a liquidity pool they control. The term comes from 'pulling the rug out from under' other investors.",
              },
              {
                q: "Can you get rugged on a bonding curve like JetForge?",
                a: "A bonding curve is structurally resistant to hard rug pulls because there is no developer-controlled liquidity pool to drain before graduation. However, large whale wallets can still sell (dump) their position, causing a significant price drop. JetForge's Anti-Rug Score monitors whale concentration and flags this risk.",
              },
              {
                q: "How do I check if a Solana token is safe?",
                a: "On JetForge, check the Anti-Rug Score (0-100) on the token page. Also review the holder distribution, verify the creator's launch history on their creator profile, and confirm social links are active with real engagement.",
              },
              {
                q: "Is a high Anti-Rug Score a guarantee of safety?",
                a: "No. The Anti-Rug Score is a risk signal based on measurable on-chain data, not a guarantee. It helps you make more informed decisions but cannot predict every possible outcome. Always trade responsibly.",
              },
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
          <div className="text-white font-bold text-xl">Trade on JetForge — Every Token Has an Anti-Rug Score</div>
          <p className="text-sm text-white/55 max-w-md mx-auto leading-6">Built-in safety signals, whale alerts, real-time OHLCV charts, and LP burn at graduation.</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-[#00ff88] hover:bg-[#00dd77] text-black font-bold px-8 py-3 rounded-xl transition-colors text-sm">
            Browse Tokens on JetForge →
          </Link>
        </div>

        {/* Related */}
        <div className="border-t border-white/8 pt-8 space-y-3">
          <div className="text-xs text-white/30 uppercase tracking-widest font-medium">Related Articles</div>
          <Link href="/blog/what-is-a-bonding-curve" className="block text-[#00ff88] hover:underline text-sm">What Is a Bonding Curve? How Solana Token Launchpads Work →</Link>
          <Link href="/blog/solana-meme-coin-guide" className="block text-white/50 hover:text-white text-sm transition-colors">Solana Meme Coin Guide — How to Buy and Trade Safely →</Link>
          <Link href="/faq" className="block text-white/50 hover:text-white text-sm transition-colors">Full JetForge FAQ →</Link>
        </div>

      </div>
    </>
  );
}
