import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "How to Launch a Token on Solana in Under 60 Seconds | JetForge",
    description:
      "Step-by-step guide to creating and launching your own Solana SPL token using JetForge. No coding required. Connect a wallet, fill the form, pay ~0.025 SOL, and your token is live on a bonding curve instantly.",
    keywords: [
      "how to launch a token on Solana",
      "create Solana token",
      "launch meme coin Solana",
      "Solana token launchpad tutorial",
      "fair launch token Solana",
      "bonding curve token launch",
      "JetForge tutorial",
      "no-code Solana token",
    ],
    alternates: { canonical: "https://jetforge.io/blog/how-to-launch-a-token-on-solana" },
    openGraph: {
      type: "article",
      url: "https://jetforge.io/blog/how-to-launch-a-token-on-solana",
      title: "How to Launch a Token on Solana in Under 60 Seconds | JetForge",
      description:
        "Step-by-step guide: connect Phantom or Solflare, fill the form, pay ~0.025 SOL, and your token is live on JetForge's bonding curve.",
      images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Launch a Solana token with JetForge" }],
      siteName: "JetForge",
      publishedTime: "2025-05-01T00:00:00Z",
      modifiedTime: "2026-05-15T00:00:00Z",
      authors: ["JetForge Team"],
    },
    twitter: {
      card: "summary_large_image",
      title: "How to Launch a Solana Token in 60 Seconds",
      description: "Step-by-step guide using JetForge. No coding. Just a wallet and a great idea.",
      images: ["/og-image.jpg"],
    },
  };
}

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Launch a Token on Solana in Under 60 Seconds",
  description:
    "Step-by-step guide to creating and launching a Solana SPL token using JetForge fair-launch bonding curve launchpad. No coding required.",
  datePublished: "2025-05-01",
  dateModified: "2026-05-15",
  url: "https://jetforge.io/blog/how-to-launch-a-token-on-solana",
  author: { "@type": "Organization", name: "JetForge Team" },
  publisher: {
    "@type": "Organization",
    name: "JetForge",
    logo: { "@type": "ImageObject", url: "https://jetforge.io/logo.png" },
  },
  image: "https://jetforge.io/og-image.jpg",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://jetforge.io/blog/how-to-launch-a-token-on-solana" },
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
      position: 1,
      name: "Connect Your Solana Wallet",
      text: "Install Phantom or Solflare wallet, fund it with at least 0.03 SOL, then click Connect Wallet in the top-right corner of JetForge.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Click Launch Token",
      text: "Navigate to jetforge.io/launch and fill in your token Name, Symbol (2-8 characters), and Description.",
      url: "https://jetforge.io/launch",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Upload Your Token Image",
      text: "Upload a PNG, JPG, GIF, or WebP image for your token. Square aspect ratio is recommended. The image appears on your token page and leaderboard.",
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Set Optional Social Links",
      text: "Add your Twitter, Telegram, and Website URLs. These links appear on your token page and significantly boost credibility with potential buyers.",
    },
    {
      "@type": "HowToStep",
      position: 5,
      name: "Review and Confirm",
      text: "Check the 1% trading fee and ~0.025 SOL rent cost, then click Launch and sign the transaction in your wallet.",
    },
    {
      "@type": "HowToStep",
      position: 6,
      name: "Your Token is Live",
      text: "Share your token page link at /token/[mint]. Your token appears on the JetForge leaderboard immediately and is tradeable by anyone.",
    },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do I need coding experience to launch a token on JetForge?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. JetForge is fully no-code. You just fill out a form, connect your Solana wallet, and sign the transaction. No Rust, Anchor, or CLI knowledge is needed.",
      },
    },
    {
      "@type": "Question",
      name: "How much SOL do I need to launch a token?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You need at least 0.03 SOL: approximately 0.025 SOL for Solana network rent to create the token account, plus a small buffer for transaction fees. This goes to the Solana network, not JetForge.",
      },
    },
    {
      "@type": "Question",
      name: "Can I launch a token on mobile?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. JetForge is fully mobile-optimised. Use the Phantom or Solflare mobile app with their built-in browsers to connect your wallet and launch on any smartphone.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if my token does not graduate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If your token does not reach the 85 SOL graduation threshold, it stays tradeable on the JetForge bonding curve indefinitely. There is no expiry. Buyers can still trade freely at any time.",
      },
    },
    {
      "@type": "Question",
      name: "What is a bonding curve?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A bonding curve is an automated market maker (AMM) where the token price rises as more people buy and falls as more people sell. The curve is governed by a mathematical formula in a smart contract, with no manual market-making required.",
      },
    },
    {
      "@type": "Question",
      name: "Can I launch multiple tokens on JetForge?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. There is no limit to how many tokens a single wallet can launch on JetForge. Each token gets its own page, bonding curve, and leaderboard entry.",
      },
    },
    {
      "@type": "Question",
      name: "Is JetForge safe to use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "JetForge is non-custodial — your SOL and tokens are controlled by on-chain smart contracts at all times. The launchpad contract code is publicly verifiable on Solana. JetForge also assigns each token an Anti-Rug Score to help buyers assess risk.",
      },
    },
    {
      "@type": "Question",
      name: "How do I promote my token after launch?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Share your /token/[mint] link on X (Twitter), Reddit communities like r/solana or r/CryptoMoonShots, and any Telegram or Discord groups relevant to your token theme. Engaging early buyers in the comments section on JetForge also builds community momentum.",
      },
    },
  ],
};

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-sm mt-0.5">
        {n}
      </div>
      <div className="space-y-1 pb-6 border-b border-white/5 flex-1 last:border-0 last:pb-0">
        <div className="font-semibold text-white">{title}</div>
        <p className="text-sm text-white/60 leading-6">{body}</p>
      </div>
    </div>
  );
}

export default function HowToPage() {
  const esc = (obj: object) =>
    JSON.stringify(obj).replace(/</g, "<").replace(/>/g, ">").replace(/&/g, "&");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: esc(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: esc(howtoJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: esc(faqJsonLd) }} />

      <div className="max-w-3xl mx-auto py-10 px-4 space-y-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/35">
          <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-white/70 transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-white/55">How to Launch a Token</span>
        </nav>

        {/* Hero */}
        <header className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 rounded-full px-2.5 py-1">Guide</span>
            <span className="text-xs text-white/30">10 min read</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            How to Launch a Token on Solana in Under 60 Seconds
          </h1>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span>By <span className="text-white/60 font-medium">JetForge Team</span></span>
            <span>·</span>
            <time dateTime="2026-05-15">May 15, 2026</time>
          </div>
          <p className="text-white/60 leading-7 text-lg">
            JetForge lets anyone create and launch a Solana SPL token with a fair-launch bonding
            curve — no coding, no presales, no dev allocations. This guide walks you through every
            step from wallet setup to sharing your live token page.
          </p>
        </header>

        {/* TL;DR */}
        <section className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 space-y-3">
          <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">TL;DR — Quick Answer</h2>
          <ul className="space-y-2 text-white/70 text-sm leading-6 list-none">
            <li className="flex gap-2">
              <span className="text-indigo-400 mt-0.5">→</span>
              <span>Connect Phantom or Solflare wallet (need ~0.03 SOL), go to <Link href="/launch" className="text-indigo-400 hover:underline">jetforge.io/launch</Link>, fill in name, symbol, image, and description.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400 mt-0.5">→</span>
              <span>Click Launch, sign the transaction. Your token is live on a bonding curve in under 60 seconds with a 1% trading fee and ~0.025 SOL rent cost.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400 mt-0.5">→</span>
              <span>Once the bonding curve hits 85 SOL, your token auto-graduates to Raydium DEX — no action needed from you.</span>
            </li>
          </ul>
        </section>

        {/* Prerequisites */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">What You Need Before You Start</h2>
          <p className="text-white/60 leading-7">
            Before you hit the Launch button, make sure you have three things ready. This is the only
            setup you need — no developer tools, no command line, no wallet seed phrase tricks.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                icon: "👛",
                title: "Phantom or Solflare Wallet",
                body: "Download the Phantom (phantom.app) or Solflare (solflare.com) browser extension or mobile app. Both support Solana dApps fully. Phantom is the most popular choice.",
              },
              {
                icon: "◎",
                title: "At Least 0.03 SOL",
                body: "You need ~0.025 SOL for Solana network rent to create the token mint account, plus a small buffer for gas fees. Adding 0.05 SOL gives comfortable room for an optional initial buy.",
              },
              {
                icon: "💡",
                title: "Your Token Idea",
                body: "Have your token name, ticker symbol (2-8 characters, e.g. DOGE), a description, and a square image ready before you start. Social links (Twitter, Telegram) are optional but recommended.",
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="rounded-xl border border-white/8 bg-white/[0.025] p-4 space-y-2">
                <div className="text-2xl">{icon}</div>
                <div className="font-semibold text-white text-sm">{title}</div>
                <p className="text-xs text-white/50 leading-5">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What is JetForge */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">What is JetForge?</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              JetForge is a no-code Solana token launchpad built around a <strong className="text-white">fair-launch bonding curve</strong> model.
              When you launch a token, it starts trading immediately on an automated market maker (AMM) governed by a
              mathematical price curve — no manual market-making, no liquidity pool to seed yourself, no presale round.
            </p>
            <p>
              Every token starts at the same price. The creator receives zero special allocation. This makes JetForge a
              genuinely level playing field: early buyers get a price advantage simply by being early, not because the
              developer gave them a private allocation before launch.
            </p>
            <p>
              When a token accumulates <strong className="text-white">85 SOL</strong> in its bonding curve, it automatically
              graduates to <strong className="text-white">Raydium DEX</strong>, one of Solana&apos;s largest decentralised exchanges.
              The migration is trustless and handled entirely by the on-chain smart contract. As the creator, you earn
              40% of all trading fees generated by your token — deposited to a creator vault you can withdraw at any time.
            </p>
          </div>
        </section>

        {/* Step-by-step */}
        <section className="space-y-0">
          <h2 className="text-2xl font-bold text-white mb-6">Step-by-Step: Launch Your Token</h2>
          <div className="space-y-0">
            <Step
              n={1}
              title="Connect Your Solana Wallet (Phantom or Solflare)"
              body="Open JetForge in your browser. In the top-right corner, click Connect Wallet. A modal will appear listing compatible wallets — select Phantom or Solflare. Approve the connection request in your wallet extension or mobile app. Once connected, your wallet address will appear in the header. Make sure your wallet holds at least 0.03 SOL before proceeding."
            />
            <Step
              n={2}
              title='Click "Launch Token" — Fill in Name, Symbol, Description'
              body="Navigate to jetforge.io/launch. You will see a form with fields for Token Name (e.g. SupraDoge), Token Symbol (e.g. SDOGE, 2-8 uppercase characters), and a Description field where you can tell buyers what your token is about. A clear, engaging description significantly increases buyer confidence — aim for at least two sentences explaining the project vision."
            />
            <Step
              n={3}
              title="Upload Your Token Image (PNG, JPG, GIF, or WebP)"
              body="Click the image upload area and select your token artwork. Supported formats are PNG, JPG, GIF, and WebP. Square images (1:1 aspect ratio) are strongly recommended — they display best on the token page, leaderboard, and any third-party aggregators that index JetForge tokens. Avoid blurry or very small images as they reduce credibility with buyers."
            />
            <Step
              n={4}
              title="Set Optional Social Links (Twitter, Telegram, Website)"
              body="Below the image upload, you will find optional fields for your Twitter/X URL, Telegram group or channel link, and website URL. Filling these in is strongly recommended — tokens with visible social links score higher on JetForge's Anti-Rug Score and attract significantly more buyers. Even a basic Twitter account or Telegram group shows buyers there is a real community behind the token."
            />
            <Step
              n={5}
              title="Review and Confirm — Check the 1% Fee and ~0.025 SOL Rent"
              body="Before clicking Launch, review the summary panel. It shows the 1% trading fee that will apply to every buy and sell on your token's bonding curve, and the ~0.025 SOL Solana network rent required to create the token mint account. This rent goes to the Solana network — not to JetForge. When you are happy with the details, click Launch and approve the transaction in your wallet."
            />
            <Step
              n={6}
              title="Your Token is Live — Share the /token/[mint] Link"
              body="Within a few seconds of the transaction confirming, your token page is live at jetforge.io/token/[mint-address]. Copy this URL and share it everywhere — Twitter, Telegram, Discord, Reddit. Your token also appears on the JetForge leaderboard immediately, where it is visible to all visitors browsing new tokens. The bonding curve is open: anyone can buy and sell right away."
            />
          </div>
        </section>

        {/* Cost table */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">How Much Does It Cost?</h2>
          <p className="text-white/60 leading-7">
            Launching on JetForge has minimal upfront cost. Here is a full breakdown of every fee you
            will encounter:
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Item</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Cost</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-3 text-white">Solana rent (token mint creation)</td>
                  <td className="px-4 py-3 text-indigo-400 font-medium">~0.025 SOL</td>
                  <td className="px-4 py-3 text-white/50">Paid to Solana network. One-time cost per token.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Trading fee</td>
                  <td className="px-4 py-3 text-indigo-400 font-medium">1% per trade</td>
                  <td className="px-4 py-3 text-white/50">Applied to every buy and sell on the bonding curve. 40% goes to you as creator.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Platform listing fee</td>
                  <td className="px-4 py-3 text-indigo-400 font-medium">$0</td>
                  <td className="px-4 py-3 text-white/50">No upfront listing or registration fee to JetForge.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Dev / creator token allocation</td>
                  <td className="px-4 py-3 text-indigo-400 font-medium">0%</td>
                  <td className="px-4 py-3 text-white/50">Fair launch only. Creator gets no special token allocation.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Raydium graduation fee</td>
                  <td className="px-4 py-3 text-indigo-400 font-medium">Automatic</td>
                  <td className="px-4 py-3 text-white/50">Handled by the smart contract at 85 SOL threshold. No manual action required.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* What happens after launch */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">What Happens After Launch</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              Once your token is live, it trades on JetForge&apos;s bonding curve — an on-chain AMM where
              the price is determined purely by supply and demand. Every purchase pushes the price up;
              every sale pushes it down. The price formula is transparent and visible in the smart contract.
            </p>
            <p>
              You earn <strong className="text-white">40% of all trading fees</strong> generated by
              your token. These accumulate in a creator vault on-chain. You can withdraw this SOL at any
              time from the token page — no waiting period, no lockup, no minimum threshold.
            </p>
            <p>
              The graduation milestone is <strong className="text-white">85 SOL</strong> in the bonding
              curve. When this threshold is hit, the smart contract automatically closes the bonding curve,
              uses the accumulated SOL and a proportional token reserve to seed a Raydium liquidity pool,
              burns the LP tokens to prevent the liquidity from being pulled, and makes the token tradeable
              on any Solana DEX aggregator (Jupiter, Raydium, and others).
            </p>
            <p>
              Graduation is a major milestone for a token. It signals legitimate community demand and
              opens the token up to the much larger Raydium and aggregator trading volume.
            </p>
          </div>
        </section>

        {/* vs pump.fun */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">JetForge vs pump.fun: Which Should You Use?</h2>
          <p className="text-white/60 leading-7">
            Both platforms are Solana fair-launch launchpads, but they differ in key ways. Here is a
            quick comparison to help you decide which platform is right for your token launch:
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Feature</th>
                  <th className="text-left px-4 py-3 text-indigo-400 font-medium">JetForge</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">pump.fun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-3 text-white">Creator fee share</td>
                  <td className="px-4 py-3 text-indigo-400">40% of trading fees</td>
                  <td className="px-4 py-3 text-white/50">0% to creator</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Anti-rug score</td>
                  <td className="px-4 py-3 text-indigo-400">Yes (0-100 score)</td>
                  <td className="px-4 py-3 text-white/50">No</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Graduation threshold</td>
                  <td className="px-4 py-3 text-indigo-400">85 SOL</td>
                  <td className="px-4 py-3 text-white/50">~85 SOL equivalent</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Graduation DEX</td>
                  <td className="px-4 py-3 text-indigo-400">Raydium (auto)</td>
                  <td className="px-4 py-3 text-white/50">Raydium (auto)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Mobile optimised</td>
                  <td className="px-4 py-3 text-indigo-400">Yes</td>
                  <td className="px-4 py-3 text-white/50">Partial</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Leaderboard</td>
                  <td className="px-4 py-3 text-indigo-400">Yes (by volume)</td>
                  <td className="px-4 py-3 text-white/50">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-white/50 text-sm">
            For a deeper analysis, see our full comparison:{" "}
            <Link href="/blog/jetforge-vs-pumpfun" className="text-indigo-400 hover:underline">
              JetForge vs pump.fun — Which Launchpad Should You Use? →
            </Link>
          </p>
        </section>

        {/* Anti-Rug Score */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Anti-Rug Score: How JetForge Protects Buyers</h2>
          <div className="text-white/60 leading-7 space-y-3">
            <p>
              Every token on JetForge receives an <strong className="text-white">Anti-Rug Score</strong> — a
              number between 0 and 100 displayed prominently on each token page. A higher score means lower
              perceived risk for buyers.
            </p>
            <p>The score is calculated using several on-chain signals:</p>
            <div className="space-y-3 pl-2">
              <div className="flex gap-3">
                <span className="text-indigo-400 shrink-0 mt-1">•</span>
                <p><strong className="text-white">Creator wallet history</strong> — has this wallet launched tokens before? Did previous tokens graduate or collapse? A creator with a track record of successful launches scores higher.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 shrink-0 mt-1">•</span>
                <p><strong className="text-white">Whale concentration</strong> — what percentage of the token supply is held by the top wallets? High concentration in a few wallets is a warning sign that increases sell pressure risk.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 shrink-0 mt-1">•</span>
                <p><strong className="text-white">Trading patterns</strong> — are buys and sells organic, or do they show signs of coordinated wash trading or bot activity? Unusual patterns lower the score.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-400 shrink-0 mt-1">•</span>
                <p><strong className="text-white">Social link presence</strong> — tokens with verified social links score higher than anonymous launches with no community presence.</p>
              </div>
            </div>
            <p>
              As a creator, the best way to improve your Anti-Rug Score is to fill in all social links,
              avoid buying a very large initial allocation, and build genuine community engagement before
              and after launch.
            </p>
          </div>
        </section>

        {/* Tips */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Tips for a Successful Token Launch</h2>
          <div className="space-y-3">
            {[
              {
                n: "01",
                title: "Build your community before you launch",
                body: "A token with zero buyers at launch rarely gains momentum. Create a Telegram group and Twitter account first. Even 20-30 genuine followers who plan to buy at launch is enough to seed early volume that attracts organic buyers from the leaderboard.",
              },
              {
                n: "02",
                title: "Post on Crypto Twitter and Reddit immediately after launch",
                body: "Share your /token/[mint] link on X with relevant hashtags (#Solana #memecoin #newtoken). Post in subreddits like r/CryptoMoonShots or r/solana. Timing matters — post within the first 10 minutes while your token is appearing at the top of the JetForge new tokens feed.",
              },
              {
                n: "03",
                title: "Respond to every comment on your token page",
                body: "JetForge token pages have a comments section. Buyers ask questions there. Responding to every comment — especially sceptical ones — shows you are an active, trustworthy creator and significantly improves buyer confidence.",
              },
              {
                n: "04",
                title: "Set all social links before you launch",
                body: "You can add social links after launch, but buyers who find your token in the first few minutes will form an instant impression. An empty social section is a red flag. Fill in at minimum a Twitter link before clicking Launch.",
              },
              {
                n: "05",
                title: "Watch whale alerts and communicate transparently",
                body: "If a single wallet buys a very large portion of your supply early, communicate transparently with your community. Unexplained whale activity is one of the top reasons buyers exit early. Transparency builds the trust that sustains long-term volume.",
              },
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
          <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
          <div className="space-y-4">

            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5 space-y-2">
              <h3 className="font-semibold text-white text-sm">Do I need coding experience to launch a token on JetForge?</h3>
              <p className="text-sm text-white/60 leading-6">No. JetForge is fully no-code. You fill out a web form, connect your Solana wallet, and sign one transaction. No Rust, Anchor, CLI, or programming knowledge is required. If you can use a browser and a wallet extension, you can launch a token.</p>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5 space-y-2">
              <h3 className="font-semibold text-white text-sm">How much SOL do I need to launch a token?</h3>
              <p className="text-sm text-white/60 leading-6">At minimum, you need approximately 0.03 SOL: ~0.025 SOL for Solana network rent to create the token mint account, plus a small buffer for transaction fees. We recommend having 0.05 SOL so you also have the option to make a small initial buy at launch. The rent cost goes to the Solana network, not JetForge.</p>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5 space-y-2">
              <h3 className="font-semibold text-white text-sm">Can I launch a token on mobile?</h3>
              <p className="text-sm text-white/60 leading-6">Yes. JetForge is fully mobile-optimised. Open JetForge in the Phantom or Solflare mobile app&apos;s built-in browser, connect your wallet, and the entire launch flow works on a smartphone screen. You can also use any mobile browser with a wallet-connect-compatible extension.</p>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5 space-y-2">
              <h3 className="font-semibold text-white text-sm">What happens if my token does not graduate to Raydium?</h3>
              <p className="text-sm text-white/60 leading-6">If your token does not reach the 85 SOL graduation threshold, it stays tradeable on the JetForge bonding curve indefinitely. There is no expiry date or delisting. Buyers can continue to buy and sell at any time. Your creator fee vault continues to accumulate as long as anyone is trading.</p>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5 space-y-2">
              <h3 className="font-semibold text-white text-sm">What is a bonding curve?</h3>
              <p className="text-sm text-white/60 leading-6">A bonding curve is an automated market maker (AMM) where the token price is set by a mathematical formula. As more people buy tokens, the price rises along the curve. As people sell, the price falls. The curve is defined in the on-chain smart contract — there is no human market-maker and no order book. Price discovery is entirely algorithmic and transparent.</p>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5 space-y-2">
              <h3 className="font-semibold text-white text-sm">Can I launch multiple tokens on JetForge?</h3>
              <p className="text-sm text-white/60 leading-6">Yes. There is no limit to how many tokens a single wallet can launch. Each token gets its own dedicated page, its own independent bonding curve, and its own leaderboard position. Each launch requires the ~0.025 SOL rent separately.</p>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5 space-y-2">
              <h3 className="font-semibold text-white text-sm">Is JetForge safe to use?</h3>
              <p className="text-sm text-white/60 leading-6">JetForge is non-custodial — your SOL and tokens are controlled by on-chain smart contracts at all times. JetForge never holds your private keys or has custody of your funds. The launchpad smart contract is publicly verifiable on Solana. Additionally, JetForge&apos;s Anti-Rug Score system gives buyers a risk signal on every token to help them make informed decisions.</p>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5 space-y-2">
              <h3 className="font-semibold text-white text-sm">How do I promote my token after launch?</h3>
              <p className="text-sm text-white/60 leading-6">Share your <code className="text-indigo-400 bg-indigo-500/10 px-1 rounded text-xs">/token/[mint]</code> link on X (Twitter) with #Solana and #memecoin hashtags. Post in Reddit communities such as r/CryptoMoonShots and r/solana. Share in relevant Telegram groups and Discord servers. Respond actively to comments on your JetForge token page to build community trust. Consistent engagement in the first 24-48 hours after launch is the single biggest driver of early volume.</p>
            </div>

          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-8 text-center space-y-4">
          <div className="text-white font-bold text-xl">Ready to Launch Your Token?</div>
          <p className="text-sm text-white/55 max-w-md mx-auto leading-6">Fair launch. Bonding curve. Auto-graduation to Raydium. 40% of fees back to you as creator. No coding required.</p>
          <Link
            href="/launch"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl transition-colors text-sm"
          >
            Launch a Token Now →
          </Link>
        </div>

        {/* Related */}
        <div className="border-t border-white/8 pt-8 space-y-3">
          <div className="text-xs text-white/30 uppercase tracking-widest font-medium">Related Articles</div>
          <Link href="/blog/jetforge-vs-pumpfun" className="block text-indigo-400 hover:underline text-sm">
            JetForge vs pump.fun — Which Launchpad Should You Use? →
          </Link>
          <Link href="/faq" className="block text-white/50 hover:text-white text-sm transition-colors">
            Full JetForge FAQ →
          </Link>
        </div>

      </div>
    </>
  );
}
