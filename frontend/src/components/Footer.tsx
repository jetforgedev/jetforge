import Link from "next/link";

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t border-[#111] mt-16 bg-[#080808]">
      <div className="max-w-[1400px] mx-auto px-4 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#00ff88] flex items-center justify-center text-black font-bold text-xs">
                J
              </div>
              <span className="font-bold text-white">
                Jet<span className="text-[#00ff88]">Forge</span>
              </span>
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
