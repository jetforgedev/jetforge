import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "About JetForge",
  description:
    "JetForge is a fair-launch Solana token launchpad built on an on-chain bonding curve. No presales, no team allocations. Learn about the platform, smart contract addresses, fee structure, and the team behind it.",
  alternates: { canonical: "https://jetforge.io/about" },
  openGraph: {
    type: "website",
    url: "https://jetforge.io/about",
    title: "About JetForge — Fair-Launch Solana Token Launchpad",
    description:
      "Learn how JetForge works, who built it, and how every token launch is fair, transparent, and verifiable on-chain.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "About JetForge" }],
    siteName: "JetForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "About JetForge",
    description:
      "Fair-launch Solana token launchpad. On-chain bonding curve, no presales, no team allocations. Transparent by design.",
    images: ["/og-image.jpg"],
  },
};

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  url: "https://jetforge.io/about",
  name: "About JetForge",
  description:
    "JetForge is a decentralized fair-launch token launchpad built on Solana. Every token starts at the same price with no insider advantages.",
  mainEntity: {
    "@type": "Organization",
    name: "JetForge",
    url: "https://jetforge.io",
    logo: "https://jetforge.io/logo.png",
    description:
      "Fair-launch Solana token launchpad powered by an on-chain bonding curve AMM. No presales, no team allocations. Transparent price discovery for everyone.",
    foundingDate: "2024",
    sameAs: [
      "https://x.com/jetforgeDev",
      "https://t.me/jetforgechat",
      "https://github.com/jetforgedev/jetforge",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://jetforge.io/support",
    },
  },
};

const PROGRAM_ID = "7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk";
const TREASURY   = "13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
      <div className="text-white/65 leading-7 space-y-3">{children}</div>
    </section>
  );
}

function AddressRow({ label, address, explorer }: { label: string; address: string; explorer: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-3 border-b border-white/6 last:border-0">
      <span className="text-white/40 text-sm w-40 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <code className="font-mono text-xs text-[#00ff88] bg-[#00ff8808] border border-[#00ff8820] rounded-lg px-2.5 py-1 break-all">
          {address}
        </code>
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[10px] text-white/30 hover:text-[#00ff88] border border-white/10 rounded-md px-2 py-1 transition-colors"
        >
          Verify ↗
        </a>
      </div>
    </div>
  );
}

export default function AboutPage() {
  const esc = (obj: object) =>
    JSON.stringify(obj)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: esc(aboutJsonLd) }}
      />

      <div className="max-w-3xl mx-auto py-10 px-4 space-y-12">

        {/* Hero */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00ff88]/18 bg-[#00ff88]/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8dffc9]">
            About JetForge
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
            Fair-launch token trading,<br className="hidden sm:block" /> built on Solana
          </h1>
          <p className="text-lg text-white/60 leading-8">
            JetForge is a decentralized launchpad where anyone can create and trade Solana tokens
            using an on-chain bonding curve. Every token starts at the same price. There are no
            presales, no team allocations, and no insider advantages — just fair price discovery
            for everyone.
          </p>
        </div>

        {/* Mission */}
        <Section title="Our mission">
          <p>
            Most token launches are rigged. Early investors get discounted allocations, insiders
            dump on retail buyers, and the price crashes before most people even get a chance to
            participate. We built JetForge to fix that.
          </p>
          <p>
            By anchoring every token to an automated on-chain bonding curve, price is determined
            purely by market demand — not by who you know or how early you heard about the launch.
            When demand rises, price rises. When people sell, the curve absorbs it. No manipulation,
            no hidden wallets, no surprises.
          </p>
          <p>
            When a token accumulates 85 SOL in its bonding curve reserve, it automatically graduates
            to Raydium — a decentralised exchange on Solana — and open-market trading begins. The
            entire process is governed by the smart contract, not by us.
          </p>
        </Section>

        {/* How it works */}
        <Section title="How it works">
          <div className="grid sm:grid-cols-3 gap-4 not-prose">
            {[
              {
                step: "1",
                title: "Create",
                body: "Upload a name, symbol, image and description. Pay ~0.025 SOL in Solana network rent. Your token is live on-chain in under 60 seconds.",
              },
              {
                step: "2",
                title: "Trade",
                body: "Anyone can buy or sell instantly via the bonding curve. Price adjusts automatically with every trade. JetForge takes 1% per transaction.",
              },
              {
                step: "3",
                title: "Graduate",
                body: "At 85 SOL in the curve, the token auto-graduates to Raydium DEX. The bonding curve closes and open-market liquidity begins.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-2">
                <div className="w-8 h-8 rounded-full bg-[#00ff8820] border border-[#00ff8840] flex items-center justify-center text-[#00ff88] font-bold text-sm">
                  {step}
                </div>
                <div className="font-semibold text-white">{title}</div>
                <div className="text-sm text-white/55 leading-6">{body}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* On-chain transparency */}
        <Section title="On-chain transparency">
          <p>
            JetForge does not custody your funds at any point. All trades, bonding curve balances,
            and graduation events are executed and recorded on the Solana blockchain. You can verify
            every transaction independently using Solana Explorer or any Solana RPC endpoint.
          </p>
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 space-y-1 not-prose">
            <AddressRow
              label="Smart Contract"
              address={PROGRAM_ID}
              explorer={`https://explorer.solana.com/address/${PROGRAM_ID}`}
            />
            <AddressRow
              label="Treasury"
              address={TREASURY}
              explorer={`https://explorer.solana.com/address/${TREASURY}`}
            />
          </div>
          <p className="text-sm">
            The smart contract is built with the{" "}
            <a href="https://www.anchor-lang.com" target="_blank" rel="noopener noreferrer" className="text-[#00ff88] hover:underline">
              Anchor framework
            </a>{" "}
            on Solana. Source code is available on{" "}
            <a href="https://github.com/jetforgedev/jetforge" target="_blank" rel="noopener noreferrer" className="text-[#00ff88] hover:underline">
              GitHub
            </a>.
          </p>
        </Section>

        {/* Fee structure */}
        <Section title="Fee structure">
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] divide-y divide-white/6 not-prose">
            {[
              { label: "Token creation",    value: "~0.025 SOL", note: "Solana network rent — paid to the network, not JetForge" },
              { label: "Trading fee",       value: "1%",         note: "Per buy or sell transaction, collected by the platform" },
              { label: "Creator allocation","value": "0%",       note: "Token creators receive no special token allocation" },
              { label: "Graduation fee",    value: "None",       note: "Automated on-chain — no additional platform fee" },
            ].map(({ label, value, note }) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-5 py-4">
                <div>
                  <div className="font-medium text-white text-sm">{label}</div>
                  <div className="text-xs text-white/35 mt-0.5">{note}</div>
                </div>
                <div className="font-mono font-bold text-[#00ff88] text-sm shrink-0">{value}</div>
              </div>
            ))}
          </div>
          <p className="text-sm">
            The 1% trading fee is split: 40% to the token creator vault (withdrawable anytime),
            20% to a per-token buyback-and-burn vault, and 40% to the platform treasury.
          </p>
        </Section>

        {/* Tech stack */}
        <Section title="Technology">
          <p>
            JetForge is built on production-grade open-source infrastructure. The smart contract
            uses the constant-product AMM formula (x × y = k) — the same model that powers
            Uniswap v2 — applied to Solana SPL tokens via the Anchor framework.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 not-prose">
            {[
              { label: "Blockchain",   value: "Solana" },
              { label: "Contracts",    value: "Anchor / Rust" },
              { label: "Frontend",     value: "Next.js 16" },
              { label: "Backend",      value: "Express + Prisma" },
              { label: "Database",     value: "PostgreSQL" },
              { label: "Real-time",    value: "Socket.IO" },
              { label: "Charts",       value: "lightweight-charts" },
              { label: "Curve model",  value: "x × y = k AMM" },
              { label: "DEX target",   value: "Raydium" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-white/6 bg-white/[0.025] px-4 py-3">
                <div className="text-[10px] uppercase tracking-widest text-white/30">{label}</div>
                <div className="mt-1 text-sm font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Team */}
        <Section title="The team">
          <p>
            JetForge is built by an independent team of Solana developers and DeFi enthusiasts.
            Like many protocol teams in the Solana ecosystem, we operate pseudonymously — the
            code and the on-chain contract are the trust mechanism, not our identities.
          </p>
          <p>
            The best way to evaluate JetForge is to verify the contract addresses above,
            read the{" "}
            <Link href="/faq" className="text-[#00ff88] hover:underline">FAQ</Link>, and review the{" "}
            <a href="https://github.com/jetforgedev/jetforge" target="_blank" rel="noopener noreferrer" className="text-[#00ff88] hover:underline">
              source code on GitHub
            </a>.
          </p>
        </Section>

        {/* Community & contact */}
        <Section title="Community &amp; contact">
          <p>
            The fastest way to reach us is through Telegram or X. We actively monitor both channels
            and respond to all genuine support requests.
          </p>
          <div className="flex flex-wrap gap-3 not-prose pt-1">
            {[
              { href: "https://x.com/jetforgeDev",              label: "𝕏 Follow on X",      color: "border-white/15 text-white/70 hover:text-white" },
              { href: "https://t.me/jetforgechat",               label: "✈️ Telegram",          color: "border-[#1d9bf030] text-[#1d9bf0] hover:border-[#1d9bf060]" },
              { href: "https://github.com/jetforgedev/jetforge", label: "GitHub",               color: "border-white/15 text-white/70 hover:text-white" },
              { href: "/support",                                 label: "Support page →",       color: "border-[#00ff8830] text-[#00ff88] hover:border-[#00ff8860]" },
            ].map(({ href, label, color }) => (
              <a
                key={href}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${color}`}
              >
                {label}
              </a>
            ))}
          </div>
        </Section>

        {/* Risk warning */}
        <div className="rounded-2xl border border-[#ff5b6e]/20 bg-[#ff5b6e]/6 px-6 py-5 space-y-2">
          <div className="font-semibold text-[#ffc5cd] text-sm">Risk Warning</div>
          <p className="text-sm text-[#ffc5cd]/75 leading-6">
            Trading meme tokens on bonding curves is highly speculative and volatile. You can lose
            your entire investment. JetForge does not provide financial advice. Please read the full{" "}
            <Link href="/disclaimer" className="underline underline-offset-2 hover:text-[#ffc5cd]">
              risk disclaimer
            </Link>{" "}
            before participating.
          </p>
        </div>

      </div>
    </>
  );
}
