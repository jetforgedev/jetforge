"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { clsx } from "clsx";
import { BrandLogo } from "@/components/BrandLogo";

/** Returns true when running on a mobile / tablet device (UA sniff). */
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export function Header() {
  const pathname = usePathname();
  const { publicKey, wallets } = useWallet();
  const { connection } = useConnection();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Show wallet-install banner on mobile when no wallet extension is detected
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  useEffect(() => {
    if (!isMobileDevice()) return;
    const installed = wallets.some(
      (w) =>
        w.readyState === WalletReadyState.Installed ||
        w.readyState === WalletReadyState.Loadable
    );
    setShowInstallBanner(!installed);
  }, [wallets]);

  useEffect(() => {
    if (!publicKey) {
      setWalletBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        setWalletBalance(lamports / 1e9);
      } catch {
        // Ignore balance fetch errors
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 15_000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/launch", label: "Launch" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/creators", label: "Creators" },
    ...(publicKey ? [{ href: `/portfolio/${publicKey.toString()}`, label: "Portfolio" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#07110f]/70 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,136,0.45),rgba(0,204,255,0.35),transparent)]" />
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <BrandLogo markClassName="transition-transform duration-200 group-hover:scale-[1.04]" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] p-1 backdrop-blur-sm md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "rounded-full px-4 py-2 text-sm font-semibold transition-all",
                pathname === link.href
                  ? "bg-white/[0.08] text-white shadow-[inset_0_-2px_0_0_#00ff88]"
                  : "text-white/48 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {publicKey && walletBalance !== null && (
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/80 backdrop-blur-sm sm:flex">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8b5cf6,#00ccff)] text-[9px] font-bold text-white">
                ◎
              </div>
              <span className="font-mono font-medium">{walletBalance.toFixed(3)} SOL</span>
            </div>
          )}

          <Link
            href="/launch"
            className="hidden rounded-full bg-[linear-gradient(90deg,#00ff88,#00e5ff)] px-4 py-2 text-sm font-extrabold text-[#03110d] shadow-[0_12px_32px_rgba(0,255,136,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(0,255,136,0.25)] sm:inline-flex"
          >
            Launch Token
          </Link>

          <WalletMultiButton
            style={{
              height: "40px",
              fontSize: "13px",
              padding: "0 14px",
              borderRadius: "14px",
              background: "linear-gradient(90deg,#00ff88,#00e5ff)",
              color: "#03110d",
              fontWeight: 800,
            }}
          />

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-xl border border-white/10 bg-white/[0.04] md:hidden"
            aria-label="Toggle menu"
          >
            <span
              className={clsx(
                "h-[2px] w-5 rounded-full bg-white/70 transition-all duration-200",
                mobileMenuOpen && "translate-y-[7px] rotate-45"
              )}
            />
            <span
              className={clsx(
                "h-[2px] w-5 rounded-full bg-white/70 transition-all duration-200",
                mobileMenuOpen && "opacity-0"
              )}
            />
            <span
              className={clsx(
                "h-[2px] w-5 rounded-full bg-white/70 transition-all duration-200",
                mobileMenuOpen && "-translate-y-[7px] -rotate-45"
              )}
            />
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-16 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Menu panel */}
          <div className="absolute inset-x-0 top-full z-50 border-b border-white/8 bg-[#07110f]/95 backdrop-blur-xl md:hidden">
            <nav className="mx-auto max-w-[1440px] flex flex-col gap-1 px-4 py-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={clsx(
                    "flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                    pathname === link.href
                      ? "bg-white/[0.08] text-white border-l-2 border-[#00ff88]"
                      : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {/* Install guidance banner — shown when no wallet is detected on mobile */}
              {showInstallBanner && (
                <div className="mt-2 rounded-xl border border-[#ffcc44]/20 bg-[#ffcc44]/5 px-4 py-3">
                  <p className="text-xs text-[#ffcc44]/90 font-medium mb-2">
                    No Solana wallet detected
                  </p>
                  <p className="text-[11px] text-white/50 mb-3">
                    Install Phantom or Solflare to connect your wallet.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href="https://phantom.app/download"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-[#9945ff] px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      Phantom ↗
                    </a>
                    <a
                      href="https://solflare.com/download"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-[#FC7227] px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      Solflare ↗
                    </a>
                  </div>
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
