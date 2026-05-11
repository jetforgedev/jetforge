"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { clsx } from "clsx";
import { BrandLogo } from "@/components/BrandLogo";

// ── Wallet install options ────────────────────────────────────────────────────

const WALLETS = [
  {
    name: "Phantom",
    tagline: "Most popular Solana wallet",
    icon: "👻",
    color: "#9945ff",
    bg: "rgba(153,69,255,0.12)",
    border: "rgba(153,69,255,0.28)",
    href: "https://phantom.app/download",
  },
  {
    name: "Solflare",
    tagline: "Feature-rich Solana wallet",
    icon: "☀️",
    color: "#FC7227",
    bg: "rgba(252,114,39,0.10)",
    border: "rgba(252,114,39,0.25)",
    href: "https://solflare.com/download",
  },
] as const;

// ── Install sheet (bottom on mobile, centered modal on desktop) ───────────────

function NoWalletSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — bottom sheet on mobile, centered modal on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install a Solana wallet"
        className={[
          /* shared */
          "fixed z-[70] bg-[#0a1510] px-5 pt-5 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]",
          /* mobile: full-width bottom sheet */
          "inset-x-0 bottom-0 rounded-t-[28px] border-t border-white/10 pb-10",
          /* desktop: centered card */
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:w-[420px] sm:rounded-[28px] sm:border sm:border-white/10 sm:pb-6",
        ].join(" ")}
      >
        {/* Drag handle (mobile only) */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />

        {/* Icon + heading */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff5b6e]/20 bg-[#ff5b6e]/8 text-2xl">
          🔌
        </div>

        <h3 className="mb-1.5 text-[17px] font-bold tracking-tight text-white">
          No Wallet Detected
        </h3>
        <p className="mb-5 text-sm leading-relaxed text-white/50">
          You need a Solana browser wallet extension to connect.
          Choose one below to install it — it only takes a minute.
        </p>

        {/* Wallet install buttons */}
        <div className="space-y-3 mb-5">
          {WALLETS.map((w) => (
            <a
              key={w.name}
              href={w.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-opacity hover:opacity-80 active:opacity-60"
              style={{ background: w.bg, borderColor: w.border }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ background: w.bg }}
              >
                {w.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">
                  Install {w.name}
                </div>
                <div className="text-xs text-white/45">{w.tagline}</div>
              </div>
              <span
                className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-white"
                style={{ background: w.color }}
              >
                Install ↗
              </span>
            </a>
          ))}
        </div>

        <p className="mb-3 text-center text-[11px] leading-5 text-white/30">
          Already installed?{" "}
          <span className="text-white/50">Refresh the page after installing.</span>
        </p>

        <button
          onClick={onClose}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-semibold text-white/50 transition-colors hover:bg-white/[0.08]"
        >
          Dismiss
        </button>
      </div>
    </>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

export function Header() {
  const pathname = usePathname();
  const { publicKey, wallets, wallet, select } = useWallet();
  const { connection } = useConnection();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNoWalletSheet, setShowNoWalletSheet] = useState(false);
  const [noWalletDetected, setNoWalletDetected] = useState(true);

  // ── Detect whether any real browser wallet extension is installed ─────────
  // We check ONLY Installed — NOT Loadable.
  // Solflare returns Loadable without its extension (it has a web wallet),
  // so checking Loadable would suppress the install sheet on a fresh browser.
  useEffect(() => {
    const hasExtension = wallets.some(
      (w) => w.readyState === WalletReadyState.Installed
    );
    setNoWalletDetected(!hasExtension);
  }, [wallets]);

  // ── Deselect adapter if no extension found ───────────────────────────────
  // select(null) fully clears the selected wallet so the button doesn't freeze.
  useEffect(() => {
    if (wallet && wallet.readyState !== WalletReadyState.Installed) {
      select(null as any);
    }
  }, [wallet, select]);

  // ── Wallet balance ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!publicKey) { setWalletBalance(null); return; }
    const fetch = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        setWalletBalance(lamports / 1e9);
      } catch { /* ignore */ }
    };
    fetch();
    const id = setInterval(fetch, 15_000);
    return () => clearInterval(id);
  }, [publicKey, connection]);

  // ── Click interceptor ref (wraps WalletMultiButton) ──────────────────────
  // Intercepts the click at the wrapper level — if no extension is installed,
  // open the install sheet instead of letting WalletMultiButton open its modal.
  // This is the safety net in case noWalletDetected state is stale on first render.
  const interceptClick = (e: React.MouseEvent) => {
    if (publicKey) return;                    // already connected — let through
    const hasExtension = wallets.some(
      (w) => w.readyState === WalletReadyState.Installed
    );
    if (!hasExtension) {
      e.stopPropagation();                    // block WalletMultiButton
      e.preventDefault();
      setShowNoWalletSheet(true);
    }
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/launch", label: "Launch" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/creators", label: "Creators" },
    ...(publicKey
      ? [{ href: `/portfolio/${publicKey.toString()}`, label: "Portfolio" }]
      : []),
  ];

  // Button shown when noWalletDetected — opens install sheet directly
  const connectNoWallet = (
    <button
      onClick={() => setShowNoWalletSheet(true)}
      className="flex items-center justify-center rounded-[14px] text-[13px] font-extrabold text-[#03110d]"
      style={{
        height: "40px",
        padding: "0 14px",
        background: "linear-gradient(90deg,#00ff88,#00e5ff)",
        minWidth: "80px",
      }}
      aria-label="Connect wallet"
    >
      Connect
    </button>
  );

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

          {/* Wallet area ─────────────────────────────────────────────────── */}
          {noWalletDetected && !publicKey ? (
            /* No extension → show our button that opens install sheet */
            connectNoWallet
          ) : (
            /* Extension present (or already connected) — wrap WalletMultiButton
               with a click interceptor as a safety net */
            <div onClick={interceptClick} style={{ display: "contents" }}>
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
            </div>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-xl border border-white/10 bg-white/[0.04] md:hidden"
            aria-label="Toggle menu"
          >
            <span className={clsx("h-[2px] w-5 rounded-full bg-white/70 transition-all duration-200", mobileMenuOpen && "translate-y-[7px] rotate-45")} />
            <span className={clsx("h-[2px] w-5 rounded-full bg-white/70 transition-all duration-200", mobileMenuOpen && "opacity-0")} />
            <span className={clsx("h-[2px] w-5 rounded-full bg-white/70 transition-all duration-200", mobileMenuOpen && "-translate-y-[7px] -rotate-45")} />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 top-16 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
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

              {noWalletDetected && !publicKey && (
                <div className="mt-2 rounded-xl border border-[#ffcc44]/20 bg-[#ffcc44]/5 px-4 py-3">
                  <p className="text-xs text-[#ffcc44]/90 font-semibold mb-1">
                    No wallet detected
                  </p>
                  <p className="text-[11px] text-white/50 mb-3">
                    Install a browser extension to trade on JetForge.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {WALLETS.map((w) => (
                      <a
                        key={w.name}
                        href={w.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white"
                        style={{ background: w.color }}
                      >
                        {w.name} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </nav>
          </div>
        </>
      )}

      {/* Install sheet */}
      {showNoWalletSheet && (
        <NoWalletSheet onClose={() => setShowNoWalletSheet(false)} />
      )}
    </header>
  );
}
