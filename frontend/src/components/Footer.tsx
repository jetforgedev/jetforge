import Link from "next/link";

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="mt-16 border-t border-white/6 bg-[#050b09]/80">
      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-5 lg:px-6">
        <div className="glass-panel-dark rounded-[32px] p-6 sm:p-8">
          <div className="mb-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div className="col-span-2 space-y-4 sm:col-span-1">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                  <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle,rgba(0,255,136,0.2),transparent_68%)]" />
                  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 2 C15 2 22 8 22 16 L15 28 L8 16 C8 8 15 2 15 2Z" fill="#00ff88" />
                    <circle cx="15" cy="13" r="3" fill="#050b09" />
                    <circle cx="15" cy="13" r="1.4" fill="#00ccff" opacity="0.85" />
                    <path d="M8 16 L4 21 L8 19Z" fill="#00ccff" />
                    <path d="M22 16 L26 21 L22 19Z" fill="#00ccff" />
                    <path d="M12.5 26 L15 31 L17.5 26Z" fill="#ff8a00" opacity="0.9" />
                    <path d="M13.8 25 L15 29 L16.2 25Z" fill="#ffcf5a" opacity="0.75" />
                  </svg>
                </div>
                <div>
                  <div className="bg-[linear-gradient(90deg,#00ff88,#00ccff)] bg-clip-text text-[17px] font-black tracking-tight text-transparent">
                    JetForge
                  </div>
                  <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/35">
                    Solana Launchpad
                  </div>
                </div>
              </div>

              <p className="text-sm leading-7 text-white/55">
                The high-signal fair-launch venue for Solana traders who want transparent curves, real-time momentum, and zero insider allocations.
              </p>

              <div className="flex items-center gap-3 pt-1">
                {[
                  ["https://twitter.com/jetforge", "𝕏", "Twitter"],
                  ["https://t.me/jetforge", "✈", "Telegram"],
                  ["https://github.com/jetforge", "⌥", "GitHub"],
                  ["https://discord.gg/jetforge", "◈", "Discord"],
                ].map(([href, label, aria]) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/50 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                    aria-label={aria}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Platform</div>
              <ul className="space-y-2.5 text-sm text-white/45">
                {[
                  { href: "/", label: "Home" },
                  { href: "/launch", label: "Launch Token" },
                  { href: "/leaderboard", label: "Leaderboard" },
                  { href: "/creators", label: "Creators" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="transition-colors hover:text-white/85">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Help</div>
              <ul className="space-y-2.5 text-sm text-white/45">
                {[
                  { href: "/faq", label: "FAQ" },
                  { href: "/support", label: "Support" },
                  { href: "https://docs.solana.com", label: "Solana Docs", external: true },
                ].map((l) => (
                  <li key={l.href}>
                    {"external" in l && l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white/85">
                        {l.label} ↗
                      </a>
                    ) : (
                      <Link href={l.href} className="transition-colors hover:text-white/85">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Legal</div>
              <ul className="space-y-2.5 text-sm text-white/45">
                {[
                  { href: "/terms", label: "Terms of Service" },
                  { href: "/disclaimer", label: "Disclaimer" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="transition-colors hover:text-white/85">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mb-8 rounded-[24px] border border-[#ff5b6e]/18 bg-[#ff5b6e]/8 px-5 py-4">
            <p className="text-center text-xs leading-6 text-[#ffc5cd] sm:text-sm">
              <strong>Risk Warning:</strong> Bonding-curve trading is volatile and experimental. JetForge is for Solana devnet experimentation only.{" "}
              <Link href="/disclaimer" className="font-semibold underline decoration-[#ff5b6e]/45 underline-offset-4 hover:text-white">
                Read the full disclaimer
              </Link>
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/8 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {YEAR} JetForge. All rights reserved. <span className="text-white/25">JetForge™ is a trademark of the JetForge team.</span>
            </p>
            <div className="flex items-center gap-4">
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
    </footer>
  );
}
