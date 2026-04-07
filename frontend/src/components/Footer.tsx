import Link from "next/link";

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t border-[#111] mt-16 bg-[#080808]">
      <div className="max-w-[1400px] mx-auto px-4 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                <div className="absolute inset-0 rounded-lg bg-[#00ff88] opacity-15 blur-sm" />
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 2 C15 2 22 8 22 16 L15 28 L8 16 C8 8 15 2 15 2Z" fill="#00ff88" />
                  <circle cx="15" cy="13" r="3" fill="#080808" />
                  <circle cx="15" cy="13" r="1.4" fill="#00ff88" opacity="0.5" />
                  <path d="M8 16 L4 21 L8 19Z" fill="#00cc6e" />
                  <path d="M22 16 L26 21 L22 19Z" fill="#00cc6e" />
                  <path d="M12.5 26 L15 31 L17.5 26Z" fill="#ff6b00" opacity="0.9" />
                  <path d="M13.8 25 L15 29 L16.2 25Z" fill="#ffaa00" opacity="0.75" />
                </svg>
              </div>
              <div className="flex flex-col leading-none gap-0.5">
                <span className="font-black text-[15px] text-white tracking-tight leading-none">
                  Jet<span className="text-[#00ff88]">Forge</span>
                </span>
                <span className="text-[8px] text-[#444] font-semibold tracking-[0.15em] uppercase leading-none">
                  Solana Launchpad
                </span>
              </div>
            </div>
            <p className="text-[#555] text-xs leading-relaxed">
              Fair-launch token platform on Solana. No presales, no team allocations. 100% bonding curve.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://twitter.com/jetforge"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white hover:border-[#333] transition-colors text-sm"
                aria-label="Twitter"
              >
                𝕏
              </a>
              <a
                href="https://t.me/jetforge"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white hover:border-[#333] transition-colors text-sm"
                aria-label="Telegram"
              >
                ✈️
              </a>
              <a
                href="https://github.com/jetforge"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white hover:border-[#333] transition-colors text-sm"
                aria-label="GitHub"
              >
                ⌥
              </a>
              <a
                href="https://discord.gg/jetforge"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white hover:border-[#333] transition-colors text-sm"
                aria-label="Discord"
              >
                ◈
              </a>
            </div>
          </div>

          {/* Platform */}
          <div className="space-y-3">
            <div className="text-white text-xs font-semibold uppercase tracking-wider">Platform</div>
            <ul className="space-y-2">
              {[
                { href: "/", label: "Home" },
                { href: "/launch", label: "Launch Token" },
                { href: "/leaderboard", label: "Leaderboard" },
                { href: "/creators", label: "Creators" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[#555] hover:text-[#888] text-xs transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div className="space-y-3">
            <div className="text-white text-xs font-semibold uppercase tracking-wider">Help</div>
            <ul className="space-y-2">
              {[
                { href: "/faq", label: "FAQ" },
                { href: "/support", label: "Support" },
                { href: "https://docs.solana.com", label: "Solana Docs", external: true },
              ].map((l) => (
                <li key={l.href}>
                  {"external" in l && l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#555] hover:text-[#888] text-xs transition-colors"
                    >
                      {l.label} ↗
                    </a>
                  ) : (
                    <Link href={l.href} className="text-[#555] hover:text-[#888] text-xs transition-colors">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <div className="text-white text-xs font-semibold uppercase tracking-wider">Legal</div>
            <ul className="space-y-2">
              {[
                { href: "/terms", label: "Terms of Service" },
                { href: "/disclaimer", label: "Disclaimer" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[#555] hover:text-[#888] text-xs transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Disclaimer banner */}
        <div className="bg-[#ff444408] border border-[#ff444420] rounded-xl p-4 mb-8">
          <p className="text-[#ff8888] text-xs leading-relaxed text-center">
            ⚠️ <strong>Risk Warning:</strong> Trading tokens on bonding curves involves significant risk of loss. JetForge is not responsible for any financial losses. This platform is for experimental use on Solana devnet only.{" "}
            <Link href="/disclaimer" className="underline hover:text-[#ff4444]">Read full disclaimer →</Link>
          </p>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-[#111]">
          <p className="text-[#444] text-xs">
            © {YEAR} JetForge. All rights reserved.{" "}
            <span className="text-[#333]">JetForge™ is a trademark of the JetForge team.</span>
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-[#444] hover:text-[#666] text-xs transition-colors">Terms</Link>
            <Link href="/disclaimer" className="text-[#444] hover:text-[#666] text-xs transition-colors">Disclaimer</Link>
            <Link href="/support" className="text-[#444] hover:text-[#666] text-xs transition-colors">Support</Link>
            <div className="flex items-center gap-1.5 text-[#333] text-xs">
              <span>Built on</span>
              <span className="text-[#9945FF] font-semibold">Solana</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
