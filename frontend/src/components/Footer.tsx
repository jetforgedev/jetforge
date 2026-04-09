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
    <footer className="mt-16 border-t border-white/6 bg-[#050b09]">
      <div className="mx-auto max-w-[1560px] px-3 py-8 sm:px-5 sm:py-14 lg:px-6">
        <div className="sm:hidden">
          <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,20,17,0.96),rgba(6,12,10,0.96))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-3">
              <BrandLogo
                markClassName="h-10 w-10 rounded-[16px]"
                titleClassName="text-[18px]"
                subtitleClassName="text-[9px] tracking-[0.18em]"
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[16px] border border-white/8 bg-white/[0.04] px-2.5 py-2">
                <div className="text-[9px] uppercase tracking-[0.16em] text-white/32">Model</div>
                <div className="mt-0.5 text-[13px] font-semibold text-white">Fair launch</div>
              </div>
              <div className="rounded-[16px] border border-white/8 bg-white/[0.04] px-2.5 py-2">
                <div className="text-[9px] uppercase tracking-[0.16em] text-white/32">Curve</div>
                <div className="mt-0.5 text-[13px] font-semibold text-white">Bonding</div>
              </div>
              <div className="rounded-[16px] border border-white/8 bg-white/[0.04] px-2.5 py-2">
                <div className="text-[9px] uppercase tracking-[0.16em] text-white/32">Network</div>
                <div className="mt-0.5 text-[13px] font-semibold text-white">Solana</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-white/8 pt-4">
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Platform</div>
                <div className="space-y-2 text-[15px] text-white/88">
                  <Link href="/" className="block transition-colors hover:text-[#00ff88]">Home</Link>
                  <Link href="/launch" className="block transition-colors hover:text-[#00ff88]">Launch</Link>
                  <Link href="/leaderboard" className="block transition-colors hover:text-[#00ff88]">Leaderboard</Link>
                  <Link href="/creators" className="block transition-colors hover:text-[#00ff88]">Creators</Link>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Resources</div>
                <div className="space-y-2 text-[15px] text-white/88">
                  <Link href="/faq" className="block transition-colors hover:text-[#00ff88]">FAQ</Link>
                  <Link href="/support" className="block transition-colors hover:text-[#00ff88]">Support</Link>
                  <Link href="/terms" className="block transition-colors hover:text-[#00ff88]">Terms</Link>
                  <Link href="/disclaimer" className="block transition-colors hover:text-[#00ff88]">Disclaimer</Link>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Community</div>
                <div className="mt-2 flex items-center gap-2">
                  {communityLinks.map(([href, label, aria]) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 min-w-[40px] items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-3 text-[11px] font-semibold text-white/60 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                      aria-label={aria}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-full border border-[#00ff88]/15 bg-[#00ff88]/8 px-3 py-1.5 text-[11px] font-semibold text-[#7dffbf]">
                Built on Solana
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-[#ff5b6e]/16 bg-[#ff5b6e]/7 px-3 py-2.5">
              <p className="text-center text-[10px] leading-5 text-[#ffc5cd]">
                <strong>Risk Warning:</strong> Volatile and experimental.{" "}
                <Link href="/disclaimer" className="font-semibold underline decoration-[#ff5b6e]/45 underline-offset-4 hover:text-white">
                  Read disclaimer
                </Link>
              </p>
            </div>

            <div className="mt-3 text-center text-[10px] leading-5 text-white/30">
              Copyright {YEAR} JetForge. All rights reserved.
            </div>
          </div>
        </div>

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
                    Solana Docs /
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
                  <span className="font-semibold text-[#00ccff]">Solana</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
