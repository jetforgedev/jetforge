import Link from "next/link";

const YEAR = new Date().getFullYear();

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
  </svg>
);

const TelegramIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 1 0 24 12 12 12 0 0 0 11.944 0Zm6.161 7.714-2.053 9.68c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.24-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.916.541Z" />
  </svg>
);

const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const DiscordIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
  </svg>
);

export function Footer() {
  return (
    <footer className="mt-16 border-t border-white/[0.06]">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-5 lg:px-6">
        <div className="rounded-[32px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-6 backdrop-blur-xl sm:p-10">

          {/* Main grid */}
          <div className="mb-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 sm:gap-x-8">

            {/* Brand col */}
            <div className="col-span-2 space-y-5 sm:col-span-1">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                  <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle,rgba(0,255,136,0.18),transparent_65%)]" />
                  <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
                    <path d="M15 2 C15 2 22 8 22 16 L15 28 L8 16 C8 8 15 2 15 2Z" fill="#00ff88" />
                    <circle cx="15" cy="13" r="3" fill="#050b09" />
                    <circle cx="15" cy="13" r="1.4" fill="#00ccff" opacity="0.85" />
                    <path d="M8 16 L4 21 L8 19Z" fill="#00ccff" />
                    <path d="M22 16 L26 21 L22 19Z" fill="#00ccff" />
                    <path d="M12.5 26 L15 31 L17.5 26Z" fill="#ff8a00" opacity="0.9" />
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

              <p className="text-sm leading-[1.75] text-white/50">
                Fair-launch token launchpad on Solana. No presales, no insider allocations — just transparent bonding curves and real-time momentum.
              </p>

              <div className="flex items-center gap-2.5">
                {[
                  { href: "https://twitter.com/jetforgeio", label: "Twitter", Icon: XIcon },
                  { href: "https://t.me/jetforge", label: "Telegram", Icon: TelegramIcon },
                  { href: "https://github.com/jetforge", label: "GitHub", Icon: GitHubIcon },
                  { href: "https://discord.gg/jetforge", label: "Discord", Icon: DiscordIcon },
                ].map(({ href, label, Icon }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/45 transition-all hover:border-[#00ff88]/30 hover:bg-[#00ff88]/[0.07] hover:text-white"
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            </div>

            {/* Platform links */}
            <div className="space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Platform</div>
              <ul className="space-y-3">
                {[
                  { href: "/", label: "Home" },
                  { href: "/launch", label: "Launch Token" },
                  { href: "/leaderboard", label: "Leaderboard" },
                  { href: "/creators", label: "Creators" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-white/45 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Help links */}
            <div className="space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Resources</div>
              <ul className="space-y-3">
                {[
                  { href: "/faq", label: "FAQ", external: false },
                  { href: "/support", label: "Support", external: false },
                  { href: "https://docs.solana.com", label: "Solana Docs", external: true },
                  { href: "https://raydium.io", label: "Raydium DEX", external: true },
                ].map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-white/45 transition-colors hover:text-white">
                        {l.label}
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 9.5l7-7M4 2.5h5.5V8"/></svg>
                      </a>
                    ) : (
                      <Link href={l.href} className="text-sm text-white/45 transition-colors hover:text-white">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal + stats */}
            <div className="space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Legal</div>
              <ul className="space-y-3">
                {[
                  { href: "/terms", label: "Terms of Service" },
                  { href: "/disclaimer", label: "Disclaimer" },
                  { href: "/privacy", label: "Privacy Policy" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-white/45 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Built on Solana badge */}
              <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#9945ff]/20 bg-[#9945ff]/[0.07] px-3 py-2">
                <svg width="14" height="14" viewBox="0 0 101 88" fill="none">
                  <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8876 0.876754 87.6771C0.563936 87.4666 0.321313 87.1671 0.179809 86.8165C0.0383056 86.4659 0.00357117 86.0802 0.0795883 85.7094C0.155606 85.3386 0.338994 84.9993 0.607765 84.7337L17.2811 67.3139C17.6435 66.9355 18.0821 66.6338 18.5694 66.4276C19.0567 66.2214 19.5824 66.1151 20.1136 66.1154H99.0524C99.4295 66.1154 99.7984 66.2278 100.111 66.4383C100.424 66.6488 100.667 66.9483 100.808 67.2989C100.95 67.6495 100.984 68.0352 100.909 68.406C100.833 68.7768 100.649 69.1161 100.38 69.3817H100.48ZM83.8068 34.3032C83.4444 33.9248 83.0058 33.6231 82.5185 33.4169C82.0312 33.2107 81.5055 33.1044 80.9743 33.1047H1.93563C1.55849 33.1047 1.18957 33.2171 0.876754 33.4276C0.563936 33.6381 0.321313 33.9376 0.179809 34.2882C0.0383056 34.6388 0.00357117 35.0245 0.0795883 35.3953C0.155606 35.7661 0.338994 36.1054 0.607765 36.371L17.2811 53.7908C17.6435 54.1692 18.0821 54.4709 18.5694 54.6771C19.0567 54.8833 19.5824 54.9896 20.1136 54.9893H99.0524C99.4295 54.9893 99.7984 54.8769 100.111 54.6664C100.424 54.4559 100.667 54.1564 100.808 53.8058C100.95 53.4552 100.984 53.0695 100.909 52.6987C100.833 52.3279 100.649 51.9886 100.38 51.723L83.8068 34.3032ZM1.93563 21.8907H80.9743C81.5055 21.891 82.0312 21.7847 82.5185 21.5785C83.0058 21.3723 83.4444 21.0706 83.8068 20.6922L100.48 3.27239C100.749 3.00679 100.933 2.66748 101.009 2.29668C101.084 1.92588 101.05 1.54018 100.908 1.18958C100.767 0.838975 100.524 0.539443 100.211 0.328956C99.8984 0.118469 99.5295 0.00606556 99.1524 0.00606556H20.1136C19.5824 0.00576773 19.0567 0.112067 18.5694 0.318256C18.0821 0.524445 17.6435 0.826139 17.2811 1.20455L0.607765 18.6243C0.338994 18.8899 0.155606 19.2292 0.0795883 19.6C0.00357117 19.9708 0.0383056 20.3565 0.179809 20.7071C0.321313 21.0577 0.563936 21.3572 0.876754 21.5677C1.18957 21.7782 1.55849 21.8906 1.93563 21.8907Z" fill="url(#sol-grad)"/>
                  <defs>
                    <linearGradient id="sol-grad" x1="0" y1="88" x2="101" y2="0" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#9945FF"/><stop offset="0.5" stopColor="#8752F3"/><stop offset="1" stopColor="#00D18C"/>
                    </linearGradient>
                  </defs>
                </svg>
                <span className="text-[11px] font-semibold text-white/60">Built on Solana</span>
              </div>
            </div>
          </div>

          {/* Risk warning */}
          <div className="mb-8 rounded-2xl border border-[#ff5b6e]/15 bg-[#ff5b6e]/[0.06] px-5 py-3.5">
            <p className="text-center text-xs leading-6 text-[#ffb3bd]">
              <strong className="font-semibold text-[#ff8a96]">Risk Warning:</strong>{" "}
              Bonding-curve trading is highly volatile and speculative. JetForge operates on Solana devnet for testing only. Never invest more than you can afford to lose.{" "}
              <Link href="/disclaimer" className="font-semibold text-[#ff8a96] underline underline-offset-3 hover:text-white">
                Full disclaimer →
              </Link>
            </p>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/30">
              © {YEAR} JetForge. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/30">
              <Link href="/terms" className="transition-colors hover:text-white/70">Terms</Link>
              <Link href="/disclaimer" className="transition-colors hover:text-white/70">Disclaimer</Link>
              <Link href="/privacy" className="transition-colors hover:text-white/70">Privacy</Link>
              <Link href="/support" className="transition-colors hover:text-white/70">Support</Link>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
