"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { clsx } from "clsx";
import { BrandLogo } from "@/components/BrandLogo";

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

// ── NoWalletSheet ─────────────────────────────────────────────────────────────
// Rendered via createPortal into document.body so the header's backdrop-filter
// does not affect position:fixed.
// Positioning is set in JS (not CSS media queries) to avoid inline-style
// specificity conflicts.

function NoWalletSheet({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  // After mount: apply desktop-centered or mobile-bottom position via JS
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (window.innerWidth >= 640) {
      // Desktop — centered modal
      Object.assign(el.style, {
        bottom:       "auto",
        left:         "50%",
        right:        "auto",
        top:          "50%",
        transform:    "translate(-50%, -50%)",
        width:        "440px",
        maxHeight:    "90vh",
        overflowY:    "auto",
        borderRadius: "28px",
        border:       "1px solid rgba(255,255,255,0.10)",
        paddingBottom:"24px",
      });
    } else {
      // Mobile — bottom sheet
      Object.assign(el.style, {
        bottom:       "0",
        left:         "0",
        right:        "0",
        top:          "auto",
        transform:    "none",
        width:        "100%",
        maxHeight:    "85vh",
        overflowY:    "auto",
        borderRadius: "28px 28px 0 0",
        borderTop:    "1px solid rgba(255,255,255,0.10)",
        paddingBottom:"env(safe-area-inset-bottom, 32px)",
      });
    }
  }, []);

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — base fixed position, JS applies the real position after mount */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Install a Solana wallet"
        className="fixed z-[9999] bg-[#0a1510] px-6 pt-6"
        style={{
          // Start hidden until JS adjusts position (avoids flash)
          bottom: 0, left: 0, right: 0,
          borderRadius: "28px 28px 0 0",
          boxShadow: "0 -20px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* Drag handle — mobile only (hidden on desktop by display:none via JS below) */}
        <div
          className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15"
          style={{ display: typeof window !== "undefined" && window.innerWidth >= 640 ? "none" : "block" }}
        />

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff5b6e]/20 bg-[#ff5b6e]/8 text-2xl">
          🔌
        </div>

        <h3 className="mb-1.5 text-[17px] font-bold tracking-tight text-white">
          No Wallet Detected
        </h3>
        <p className="mb-5 text-sm leading-relaxed text-white/50">
          You need a Solana browser wallet extension to connect.
          Choose one to install — it only takes a minute.
        </p>

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
                <div className="text-sm font-bold text-white">Install {w.name}</div>
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

        <p className="mb-3 text-center text-[11px] leading-5 text-white/35">
          Already installed?{" "}
          <span className="text-white/55 font-medium">Refresh after installing.</span>
        </p>

        <button
          onClick={onClose}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 mb-2 text-sm font-semibold text-white/50 transition-colors hover:bg-white/[0.08]"
        >
          Dismiss
        </button>
      </div>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Detect real Solana wallet extensions via window globals
  useEffect(() => {
    const check = () => {
      const has =
        !!(window as any).phantom?.solana ||
        !!(window as any).solflare ||
        !!(window as any).solana;
      setNoWalletDetected(!has);
    };
    check();
    const t = setTimeout(check, 800);
    return () => clearTimeout(t);
  }, [wallets]);

  // Deselect adapter with no real extension
  useEffect(() => {
    if (wallet && wallet.readyState !== WalletReadyState.Installed) {
      select(null as any);
    }
  }, [wallet, select]);

  // Balance fetch
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

  // Safety-net click interceptor
  const interceptClick = (e: React.MouseEvent) => {
    if (publicKey) return;
    const has =
      !!(window as any).phantom?.solana ||
      !!(window as any).solflare ||
      !!(window as any).solana;
    if (!has) {
      e.stopPropagation();
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

  const connectBtn = (
    <button
      onClick={() => setShowNoWalletSheet(true)}
      className="flex items-center justify-center rounded-[14px] text-[13px] font-extrabold text-[#03110d]"
      style={{
        height: "40px",
        padding: "0 14px",
        background: "linear-gradient(90deg,#00ff88,#00e5ff)",
        minWidth: "80px",
      }}
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
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8b5cf6,#00ccff)] text-[9px] font-bold text-white">◎</div>
              <span className="font-mono font-medium">{walletBalance.toFixed(3)} SOL</span>
            </div>
          )}

          <Link
            href="/launch"
            className="hidden rounded-full bg-[linear-gradient(90deg,#00ff88,#00e5ff)] px-4 py-2 text-sm font-extrabold text-[#03110d] shadow-[0_12px_32px_rgba(0,255,136,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(0,255,136,0.25)] sm:inline-flex"
          >
            Launch Token
          </Link>

          {mounted && noWalletDetected && !publicKey ? (
            connectBtn
          ) : (
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

      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 top-16 z-40 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
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
                  <p className="text-xs text-[#ffcc44]/90 font-semibold mb-1">No wallet detected</p>
                  <p className="text-[11px] text-white/50 mb-3">Install a Solana extension to trade.</p>
                  <div className="flex gap-2 flex-wrap">
                    {WALLETS.map((w) => (
                      <a key={w.name} href={w.href} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white"
                        style={{ background: w.color }}>
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

      {mounted && showNoWalletSheet && (
        <NoWalletSheet onClose={() => setShowNoWalletSheet(false)} />
      )}
    </header>
  );
}
