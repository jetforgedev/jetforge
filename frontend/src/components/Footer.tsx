import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const YEAR = new Date().getFullYear();

const communityLinks = [
  ["https://x.com/jetforgeDev", "X", "Twitter"],
  ["https://t.me/jetforgechat", "TG", "Telegram"],
  ["https://github.com/jetforge", "GH", "GitHub"],
] as const;

export function Footer() {
  return (
    <footer className="mt-4 border-t border-white/6 bg-[#050b09] sm:mt-16">
      <div className="mx-auto max-w-[1560px] px-3 py-3 sm:px-5 sm:py-14 lg:px-6">

        {/* ── Mobile footer — minimal strip ── */}
        <div className="sm:hidden py-3">
          {/* Brand + community row */}
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <BrandLogo
              markClassName="h-7 w-7 rounded-[10px]"
              titleClassName="text-[13px]"
              subtitleClassName="text-[7px] tracking-[0.12em]"
            />
            <div className="flex items-center gap-1.5">
              {communityLinks.map(([href, label, aria]) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-6 min-w-[30px] items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] px-1.5 text-[10px] font-semibold text-white/45"
                  aria-label={aria}
                >
                  {label}
                </a>
              ))}
              <div className="rounded-full border border-[#9945ff]/18 bg-[#9945ff]/8 px-2 py-0.5 text-[8px] font-semibold text-[#c084fc]">
                Solana
              </div>
            </div>
          </div>
          {/* Risk warning — 1 line */}
          <p className="text-center text-[9px] leading-4 text-[#ffc5cd]/75 mb-2">
            <strong>Risk Warning:</strong> Volatile and experimental.{" "}
            <Link href="/disclaimer" className="underline underline-offset-2 opacity-80">Disclaimer</Link>
            {" · "}
            <Link href="/terms" className="underline underline-offset-2 opacity-60">Terms</Link>
          </p>
          <div className="text-center text-[9px] text-white/18">
            © {YEAR} JetForge
          </div>
        </div>

        {/* ── Desktop footer ── */}
        <div className="hidden sm:block">
          <div className="rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,20,17,0.95),rgba(6,12,10,0.95))] p-8 shadow-[0_28px_70px_rgba(0,0,0,0.28)]">
            <div className="grid gap-10 border-b border-white/8 pb-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <BrandLogo />
                </div>

                <p className="max-w-md text-sm leading-7 text-white/55">
                  A fair-launch venue for Solana creators and traders. Transparent curves, instant discovery, and a cleaner path from launch to liquidity.
                </p>

                <div className="grid max-w-md grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">Model</div>
                    <div className="mt-1 text-sm font-semibold text-white">Fair launch</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">Curve</div>
                    <div className="mt-1 text-sm font-semibold text-white">Bonding</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">Network</div>
                    <div className="mt-1 text-sm font-semibold text-white">Solana</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Platform</div>
                <div className="space-y-3 text-sm text-white/48">
                  <Link href="/" className="block transition-colors hover:text-white/85">Home</Link>
                  <Link href="/launch" className="block transition-colors hover:text-white/85">Launch Token</Link>
                  <Link href="/leaderboard" className="block transition-colors hover:text-white/85">Leaderboard</Link>
                  <Link href="/creators" className="block transition-colors hover:text-white/85">Creators</Link>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Resources</div>
                <div className="space-y-3 text-sm text-white/48">
                  <Link href="/faq" className="block transition-colors hover:text-white/85">FAQ</Link>
                  <Link href="/support" className="block transition-colors hover:text-white/85">Support</Link>
                  <a href="https://docs.solana.com" target="_blank" rel="noopener noreferrer" className="block transition-colors hover:text-white/85">
                    Solana Docs ↗
                  </a>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Legal</div>
                <div className="space-y-3 text-sm text-white/48">
                  <Link href="/terms" className="block transition-colors hover:text-white/85">Terms of Service</Link>
                  <Link href="/disclaimer" className="block transition-colors hover:text-white/85">Disclaimer</Link>
                </div>

                <div className="pt-2">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Community</div>
                  <div className="flex items-center gap-2">
                    {communityLinks.map(([href, label, aria]) => (
                      <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-10 min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/60 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                        aria-label={aria}
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-[#ff5b6e]/16 bg-[#ff5b6e]/7 px-5 py-4">
              <p className="text-center text-sm leading-6 text-[#ffc5cd]">
                <strong>Risk Warning:</strong> Bonding-curve trading is volatile and experimental. JetForge is for Solana devnet experimentation only.{" "}
                <Link href="/disclaimer" className="font-semibold underline decoration-[#ff5b6e]/45 underline-offset-4 hover:text-white">
                  Read the full disclaimer
                </Link>
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Copyright {YEAR} JetForge. All rights reserved. <span className="text-white/22">JetForge is a trademark of the JetForge team.</span>
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/terms" className="transition-colors hover:text-white/75">Terms</Link>
                <Link href="/disclaimer" className="transition-colors hover:text-white/75">Disclaimer</Link>
                <Link href="/support" className="transition-colors hover:text-white/75">Support</Link>
                <div className="flex items-center gap-1.5">
                  <span>Built on</span>
                  <span className="font-semibold text-[#c084fc]">Solana</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
