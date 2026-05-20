import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Earn Passive SOL Income: JetForge's Referral Program Explained",
  description:
    "Share your referral link and earn 10% of platform fees from every trade your referrals make — forever. Here's exactly how JetForge's referral system works.",
  alternates: { canonical: "https://jetforge.io/blog/jetforge-referral-program" },
  openGraph: {
    type: "article",
    url: "https://jetforge.io/blog/jetforge-referral-program",
    title: "Earn Passive SOL Income: JetForge's Referral Program Explained",
    description:
      "Share your referral link and earn 10% of platform fees from every trade your referrals make — forever. No cap, no expiry.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "JetForge Referral Program" }],
    siteName: "JetForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "Earn Passive SOL Income: JetForge's Referral Program Explained",
    description:
      "10% of platform fees from every trade your referrals make — forever. Here's how it works.",
    images: ["/og-image.jpg"],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Earn Passive SOL Income: JetForge's Referral Program Explained",
  description:
    "Share your referral link and earn 10% of platform fees from every trade your referrals make — forever. Here's exactly how JetForge's referral system works.",
  url: "https://jetforge.io/blog/jetforge-referral-program",
  datePublished: "2026-05-16",
  dateModified: "2026-05-16",
  author: { "@type": "Organization", name: "JetForge Team", url: "https://jetforge.io" },
  publisher: {
    "@type": "Organization",
    name: "JetForge",
    logo: { "@type": "ImageObject", url: "https://jetforge.io/icon.png" },
  },
  image: "https://jetforge.io/og-image.jpg",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://jetforge.io/blog/jetforge-referral-program" },
  keywords: ["solana referral program", "earn sol", "passive income crypto", "jetforge referral", "solana launchpad"],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How much can I earn from JetForge referrals?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "There is no cap. You earn 10% of JetForge's platform fee on every trade your referrals make, forever. If your referrals generate 1,000 SOL in trading volume, you earn 1 SOL (0.1% of volume).",
      },
    },
    {
      "@type": "Question",
      name: "Does the referral relationship expire?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Once someone signs up through your link, every trade they ever make on JetForge earns you 10% of the platform fee for life.",
      },
    },
    {
      "@type": "Question",
      name: "What cashback do referred users get?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "New users who join through a referral link get 10% cashback on every trade for their first 30 days. After 30 days the cashback stops, but the referrer continues earning forever.",
      },
    },
    {
      "@type": "Question",
      name: "How do I withdraw my referral earnings?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Go to your creator profile dashboard on JetForge. When your balance reaches 0.1 SOL, you can request a withdrawal. There is a 24-hour cooldown between withdrawals.",
      },
    },
  ],
};

export default function ReferralProgramBlogPost() {
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

      <article className="max-w-3xl mx-auto py-10 px-4">
        {/* Header */}
        <div className="mb-10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#00ff88] bg-[#00ff8810] border border-[#00ff8825] rounded-full px-2.5 py-1">
              Guide
            </span>
            <span className="text-[11px] text-white/30">5 min read</span>
            <span className="text-[11px] text-white/30">&middot;</span>
            <time className="text-[11px] text-white/30" dateTime="2026-05-16">
              May 16, 2026
            </time>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-snug">
            Earn Passive SOL Income: JetForge&apos;s Referral Program Explained
          </h1>
          <p className="text-white/55 leading-7 text-lg">
            Most launchpads take every fee for themselves. JetForge shares 10% of platform revenue with anyone who brings in traders. Here&apos;s how the referral system works and how to start earning.
          </p>
        </div>

        {/* Body */}
        <div className="prose prose-invert max-w-none space-y-8 text-white/70 leading-7">

          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Most Launchpads Take Everything</h2>
            <p>
              On most Solana token launchpads, fees flow in one direction: to the platform. You can promote a project, bring in traders, and drive volume — but you never see a cent of the fees generated by the activity you created.
            </p>
            <p className="mt-3">
              JetForge is built differently. The platform charges a 1% fee on every buy and sell. A portion of that fee — 10% — is set aside for whoever referred the trader to JetForge. That&apos;s passive SOL income that accumulates every time someone you referred places a trade.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">How the Referral Link Works</h2>
            <p>
              Every creator on JetForge gets a unique referral link. The flow is simple:
            </p>
            <ol className="list-decimal list-inside space-y-2 mt-3 text-white/65">
              <li><strong className="text-white">Get your link</strong> — connect your wallet, go to your creator profile, and sign in. Your referral code is generated instantly.</li>
              <li><strong className="text-white">Share it</strong> — post it on X (Twitter), Telegram, Discord, or anywhere your audience hangs out.</li>
              <li><strong className="text-white">Earn forever</strong> — when someone clicks your link and connects their wallet, they&apos;re registered as your referral. Every trade they ever make on JetForge earns you 10% of the platform fee.</li>
            </ol>
            <p className="mt-3">
              The referral is permanent. There is no time limit. If someone signs up through your link today and is still trading on JetForge in two years, you&apos;re still earning.
            </p>
          </section>

          {/* Section 3: Fee math */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">The Fee Math</h2>
            <p>
              JetForge charges 1% on every trade. That fee is split between four recipients:
            </p>
            <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left px-4 py-3 text-white/50 font-semibold">Recipient</th>
                    <th className="text-right px-4 py-3 text-white/50 font-semibold">Share</th>
                    <th className="text-right px-4 py-3 text-white/50 font-semibold">On 100 SOL volume</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { r: "Token creator vault", s: "40%", v: "0.40 SOL" },
                    { r: "Buyback & burn", s: "20%", v: "0.20 SOL" },
                    { r: "Platform treasury", s: "30%", v: "0.30 SOL" },
                    { r: "You (referrer)", s: "10%", v: "0.10 SOL", highlight: true },
                  ].map(({ r, s, v, highlight }) => (
                    <tr key={r} className="border-b border-white/6 last:border-0">
                      <td className={`px-4 py-3 ${highlight ? "text-[#00ff88] font-semibold" : "text-white/70"}`}>{r}</td>
                      <td className={`px-4 py-3 text-right font-mono ${highlight ? "text-[#00ff88] font-semibold" : "text-white/50"}`}>{s}</td>
                      <td className={`px-4 py-3 text-right font-mono ${highlight ? "text-[#00ff88] font-semibold" : "text-white/50"}`}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-white/50">
              Your 10% comes from the platform&apos;s share. The token creator&apos;s 40% and the buyback vault&apos;s 20% are never reduced, regardless of whether a referral is active.
            </p>
            <p className="mt-3">
              In practical terms: if your referrals generate 1,000 SOL in trading volume, you earn 1 SOL. That&apos;s 0.1% of volume — an ongoing royalty stream from activity you initiated once.
            </p>
          </section>

          {/* Section 4: Double-sided benefit */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Both Sides Win: The 30-Day Cashback</h2>
            <p>
              Referral programs are hard to promote when the benefit flows entirely to the referrer. JetForge solves this by making the deal two-sided.
            </p>
            <p className="mt-3">
              When a new user joins through your referral link, they automatically receive <strong className="text-white">10% cashback on every trade for their first 30 days</strong>. The cashback accumulates in their account and can be claimed when it reaches 0.05 SOL.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="text-[#00ff88] font-bold text-sm mb-2">Referrer earns</div>
                <div className="text-white/70 text-sm">10% of platform fees from every trade — forever, no time limit</div>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="text-[#00ff88] font-bold text-sm mb-2">Referred user earns</div>
                <div className="text-white/70 text-sm">10% cashback on every trade for their first 30 days</div>
              </div>
            </div>
            <p className="mt-3">
              This makes your referral link genuinely valuable to share. Instead of asking someone to sign up for your benefit, you&apos;re offering them a discount on trading fees for a month.
            </p>
          </section>

          {/* Section 5: Withdrawals */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">How Withdrawals Work</h2>
            <p>
              Your referral earnings accumulate automatically in your JetForge account — no manual claiming required between trades. Every time a referred user trades, your balance increments in real time.
            </p>
            <p className="mt-3">
              When you&apos;re ready to withdraw:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-2 text-white/65">
              <li>Minimum withdrawal is <strong className="text-white">0.1 SOL</strong></li>
              <li>Request from your creator profile dashboard</li>
              <li>Paid to your connected wallet</li>
              <li>24-hour cooldown between withdrawals (earnings never expire)</li>
            </ul>
          </section>

          {/* Section 6: Abuse prevention */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Abuse Prevention</h2>
            <p>
              The referral system includes several protections to keep it fair:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-2 text-white/65">
              <li><strong className="text-white">Self-referrals blocked</strong> — you cannot earn fees from your own trades</li>
              <li><strong className="text-white">Circular referrals blocked</strong> — if A refers B, B cannot refer A</li>
              <li><strong className="text-white">First referrer wins</strong> — a wallet can only be registered to one referrer</li>
              <li><strong className="text-white">Rate limit</strong> — maximum 50 new referrals registered per referrer per 24 hours</li>
              <li><strong className="text-white">Minimum trade size</strong> — trades under 0.05 SOL do not generate referral earnings (dust protection)</li>
            </ul>
          </section>

          {/* Section 7: How to get your link */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">How to Get Your Referral Link</h2>
            <ol className="list-decimal list-inside space-y-3 text-white/65">
              <li>Go to <Link href="/creators" className="text-[#00ff88] hover:underline">jetforge.io/creators</Link></li>
              <li>Click your wallet address or search for your profile</li>
              <li>Click <strong className="text-white">Sign in with Wallet</strong> and approve the signature request (no transaction, no fee)</li>
              <li>Your referral link appears in the dashboard section of your profile</li>
              <li>Copy it and start sharing</li>
            </ol>
            <p className="mt-3">
              The link format is <code className="bg-white/[0.06] border border-white/10 rounded px-1.5 py-0.5 text-sm text-[#00ff88]">jetforge.io/r/[your-code]</code>. Anyone who visits that URL and connects their wallet is registered as your referral.
            </p>
          </section>

          {/* CTA */}
          <div className="rounded-2xl border border-[#00ff88]/20 bg-[#0f2a1f]/50 p-6 mt-8">
            <h3 className="text-lg font-bold text-white mb-2">Ready to start earning?</h3>
            <p className="text-white/60 text-sm mb-4">
              Get your referral link in under a minute. No setup required — just connect your wallet and sign in.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/creators"
                className="inline-flex items-center gap-2 bg-[#00ff88] text-black font-bold px-5 py-2.5 rounded-xl hover:bg-[#00cc66] transition-all text-sm"
              >
                Get My Referral Link &rarr;
              </Link>
              <Link
                href="/referral"
                className="inline-flex items-center gap-2 border border-white/15 text-white/70 font-semibold px-5 py-2.5 rounded-xl hover:border-white/30 hover:text-white transition-all text-sm"
              >
                Learn More About the Program
              </Link>
            </div>
          </div>

        </div>

        {/* Back to blog */}
        <div className="mt-12 pt-8 border-t border-white/8">
          <Link href="/blog" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            &larr; Back to Blog
          </Link>
        </div>
      </article>
    </>
  );
}
