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

// ── Wallet data ───────────────────────────────────────────────────────────────
const WALLETS = [
  {
    name: "Phantom",
    tagline: "Most popular Solana wallet",
    icon: "👻",
    color: "#9945ff",
    bg: "rgba(153,69,255,0.12)",
    border: "rgba(153,69,255,0.28)",
    installHref: "https://phantom.app/download",
    // Use phantom:// custom URL scheme — more reliable than Universal Links on iOS.
    // Universal links (phantom.app/ul/v1/browse/) open the app but iOS sometimes
    // does not forward the URL, landing Phantom on its home screen instead.
    // The custom scheme directly encodes the action and works reliably.
    mobileHref: (url: string) =>
      `phantom://v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(url)}`,
    // App Store fallback when phantom:// fails (app not installed)
    fallbackHref: "https://apps.apple.com/app/phantom-crypto-wallet/id1598432977",
  },
  {
    name: "Solflare",
    tagline: "Feature-rich Solana wallet",
    icon: "☀️",
    color: "#FC7227",
    bg: "rgba(252,114,39,0.10)",
    border: "rgba(252,114,39,0.25)",
    installHref: "https://solflare.com/download",
    // Universal link: opens Solflare app and loads the current URL inside it
    mobileHref: (url: string) =>
      `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(url)}`,
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function hasSolanaExtension() {
  if (typeof window === "undefined") return false;
  return (
    !!(window as any).phantom?.solana ||
    !!(window as any).solflare ||
    !!(window as any).solana
  );
}

// ── Desktop install sheet (portal, centered on desktop / bottom sheet mobile) ─
function InstallSheet({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (window.innerWidth >= 640) {
      Object.assign(el.style, {
        bottom: "auto", left: "50%", right: "auto", top: "50%",
        transform: "translate(-50%, -50%)", width: "440px",
        maxHeight: "90vh", overflowY: "auto", borderRadius: "28px",
        border: "1px solid rgba(255,255,255,0.10)", paddingBottom: "24px",
      });
    } else {
      Object.assign(el.style, {
        bottom: "0", left: "0", right: "0", top: "auto",
        transform: "none", width: "100%", maxHeight: "85vh",
        overflowY: "auto", borderRadius: "28px 28px 0 0",
        borderTop: "1px solid rgba(255,255,255,0.10)",
        paddingBottom: "env(safe-area-inset-bottom, 32px)",
      });
    }
  }, []);

  const content = (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-label="Install a Solana wallet"
        className="fixed z-[9999] bg-[#0a1510] px-6 pt-6"
        style={{ bottom: 0, left: 0, right: 0, borderRadius: "28px 28px 0 0", boxShadow: "0 -20px 80px rgba(0,0,0,0.7)" }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff5b6e]/20 bg-[#ff5b6e]/8 text-2xl">🔌</div>
        <h3 className="mb-1.5 text-[17px] font-bold text-white">No Wallet Detected</h3>
        <p className="mb-5 text-sm leading-relaxed text-white/50">
          Install a Solana browser extension to connect.
        </p>
        <div className="space-y-3 mb-5">
          {WALLETS.map((w) => (
            <a key={w.name} href={w.installHref} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-opacity hover:opacity-80 active:opacity-60"
              style={{ background: w.bg, borderColor: w.border }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: w.bg }}>{w.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">Install {w.name}</div>
                <div className="text-xs text-white/45">{w.tagline}</div>
              </div>
              <span className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-white" style={{ background: w.color }}>Install ↗</span>
            </a>
          ))}
        </div>
        <p className="mb-3 text-center text-[11px] text-white/35">
          Already installed? <span className="text-white/55 font-medium">Refresh after installing.</span>
        </p>
        <button onClick={onClose}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 mb-2 text-sm font-semibold text-white/50 hover:bg-white/[0.08]">
          Dismiss
        </button>
      </div>
    </>
  );
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

// ── Mobile "Open in wallet" sheet ─────────────────────────────────────────────
// Shown on mobile browsers (not inside a wallet's built-in browser).
// Clicking opens the wallet app and loads the current page inside it.
// The wallet then injects window.phantom.solana / window.solflare and the
// user can connect normally.
function MobileWalletSheet({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    setPageUrl(window.location.href);
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    // Always bottom sheet on mobile
    Object.assign(el.style, {
      bottom: "0", left: "0", right: "0", top: "auto",
      transform: "none", width: "100%",
      borderRadius: "28px 28px 0 0",
      borderTop: "1px solid rgba(255,255,255,0.10)",
      paddingBottom: "env(safe-area-inset-bottom, 32px)",
    });
  }, []);

  const content = (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog" aria-modal="true"
        className="fixed z-[9999] bg-[#0a1510] px-6 pt-6"
        style={{ bottom: 0, left: 0, right: 0, borderRadius: "28px 28px 0 0", boxShadow: "0 -24px 80px rgba(0,0,0,0.7)" }}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00ff88]/20 bg-[#00ff88]/8 text-2xl">👛</div>
        <h3 className="mb-1.5 text-[17px] font-bold text-white">Connect Wallet</h3>
        <p className="mb-5 text-sm leading-relaxed text-white/50">
          Open this page inside your wallet app to connect. The app will return you here automatically.
        </p>

        <div className="space-y-3 mb-5">
          {WALLETS.map((w) => {
            // Build the href for this wallet:
            // - Phantom: uses phantom:// custom scheme (more reliable on iOS than
            //   Universal Links which sometimes open the app without the URL).
            // - Solflare: uses https://solflare.com/ul/v1/browse/ Universal Link.
            const href = pageUrl ? w.mobileHref(pageUrl) : w.installHref;
            const isCustomScheme = href.startsWith("phantom://") || href.startsWith("solflare://");

            const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
              if (!isCustomScheme || !pageUrl) return;
              // For custom schemes: use window.location to trigger the scheme.
              // Then start a timeout — if the app opens, the page loses focus
              // (visibilitychange / blur fires) and we cancel. If focus stays
              // (app not installed), redirect to fallback (App Store).
              e.preventDefault();
              const fallback = (w as any).fallbackHref || w.installHref;
              let redirected = false;
              const timer = setTimeout(() => {
                if (!redirected) window.location.href = fallback;
              }, 1500);
              const cancel = () => { redirected = true; clearTimeout(timer); };
              document.addEventListener("visibilitychange", cancel, { once: true });
              window.addEventListener("blur", cancel, { once: true });
              window.location.href = href;
            };

            return (
              <a
                key={w.name}
                href={href}
                onClick={handleClick}
                className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-opacity active:opacity-60"
                style={{ background: w.bg, borderColor: w.border }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: w.bg }}>{w.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">Open in {w.name}</div>
                  <div className="text-xs text-white/45">{w.tagline}</div>
                </div>
                <span className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-white" style={{ background: w.color }}>Open ↗</span>
              </a>
            );
          })}
        </div>

        <p className="mb-3 text-center text-[11px] text-white/35">
          Don't have a wallet?{" "}
          <a href="https://phantom.app/download" target="_blank" rel="noopener noreferrer" className="text-white/55 font-medium underline underline-offset-2">
            Get Phantom
          </a>
        </p>

        <button onClick={onClose}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 mb-2 text-sm font-semibold text-white/50 hover:bg-white/[0.08]">
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
  const [showInstallSheet, setShowInstallSheet] = useState(false);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Three states we care about (computed once after mount):
  // - isMobile: phone/tablet user agent
  // - inWalletBrowser: page opened INSIDE Phantom/Solflare built-in browser
  // - hasSolanaExt: desktop Solana browser extension present
  const [isMobile, setIsMobile] = useState(false);
  const [inWalletBrowser, setInWalletBrowser] = useState(false);
  const [hasSolanaExt, setHasSolanaExt] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mobile = isMobileUA();
    setIsMobile(mobile);
    const inWallet = hasSolanaExtension();
    setInWalletBrowser(inWallet);
    if (!mobile) {
      setHasSolanaExt(inWallet); // on desktop, same check
    }
    // Re-check after extensions may have loaded
    const t = setTimeout(() => {
      const ext = hasSolanaExtension();
      setInWalletBrowser(ext);
      if (!mobile) setHasSolanaExt(ext);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  // On desktop: deselect non-installed adapters + redirect Solflare to install
  useEffect(() => {
    if (!wallet || isMobile) return;
    if (wallet.readyState !== WalletReadyState.Installed) {
      const name = (wallet.adapter as any)?.name ?? (wallet as any).name ?? "";
      if (name === "Solflare") {
        window.open("https://solflare.com/download", "_blank", "noopener,noreferrer");
      }
      select(null as any);
    }
  }, [wallet, select, isMobile]);

  // Balance
  useEffect(() => {
    if (!publicKey) { setWalletBalance(null); return; }
    const go = async () => {
      try { setWalletBalance((await connection.getBalance(publicKey)) / 1e9); } catch { /* ignore */ }
    };
    go();
    const id = setInterval(go, 15_000);
    return () => clearInterval(id);
  }, [publicKey, connection]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/launch", label: "Launch" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/creators", label: "Creators" },
    ...(publicKey ? [{ href: `/portfolio/${publicKey.toString()}`, label: "Portfolio" }] : []),
  ];

  // ── Wallet button logic ───────────────────────────────────────────────────
  // We render different things depending on device + wallet state.
  // Rule: NEVER wrap WalletMultiButton in a click-interceptor when connected
  //       (causes iOS touch issues on the connected-state dropdown).
  const walletBtnStyle = {
    height: "40px", fontSize: "13px", padding: "0 14px",
    borderRadius: "14px",
    background: "linear-gradient(90deg,#00ff88,#00e5ff)",
    color: "#03110d", fontWeight: 800,
  };

  let walletArea: React.ReactNode = null;

  if (!mounted) {
    // SSR / before hydration — show placeholder matching WalletMultiButton size
    walletArea = (
      <div style={{ height: 40, width: 80, borderRadius: 14, background: "linear-gradient(90deg,#00ff88,#00e5ff)" }} />
    );
  } else if (publicKey) {
    // ── Connected: always plain WalletMultiButton, no wrapper ──────────────
    // Wrapping it caused iOS tap events on the connected-state button to be
    // swallowed, preventing the disconnect/change-wallet modal from opening.
    walletArea = <WalletMultiButton style={walletBtnStyle} />;

  } else if (isMobile && !inWalletBrowser) {
    // ── Mobile, regular browser (Chrome/Safari) ────────────────────────────
    // PhantomWalletAdapter is NotDetected here — clicking Phantom in the picker
    // does nothing on Android. Show our own button that deep-links to the
    // wallet app (universal link loads the current page inside the wallet browser).
    walletArea = (
      <button
        onClick={() => setShowMobileSheet(true)}
        className="flex items-center justify-center rounded-[14px] text-[13px] font-extrabold text-[#03110d]"
        style={{ height: 40, padding: "0 14px", background: "linear-gradient(90deg,#00ff88,#00e5ff)", minWidth: 80 }}
      >
        Connect
      </button>
    );

  } else if (!isMobile && !hasSolanaExt) {
    // ── Desktop, no Solana extension ──────────────────────────────────────
    walletArea = (
      <button
        onClick={() => setShowInstallSheet(true)}
        className="flex items-center justify-center rounded-[14px] text-[13px] font-extrabold text-[#03110d]"
        style={{ height: 40, padding: "0 14px", background: "linear-gradient(90deg,#00ff88,#00e5ff)", minWidth: 80 }}
      >
        Connect
      </button>
    );

  } else {
    // ── Desktop with extension OR inside wallet browser ────────────────────
    // WalletMultiButton detects extensions correctly and connects directly.
    walletArea = <WalletMultiButton style={walletBtnStyle} />;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#07110f]/70 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,136,0.45),rgba(0,204,255,0.35),transparent)]" />
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <BrandLogo markClassName="transition-transform duration-200 group-hover:scale-[1.04]" />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] p-1 backdrop-blur-sm md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}
              className={clsx("rounded-full px-4 py-2 text-sm font-semibold transition-all",
                pathname === link.href
                  ? "bg-white/[0.08] text-white shadow-[inset_0_-2px_0_0_#00ff88]"
                  : "text-white/48 hover:text-white hover:bg-white/[0.05]")}>
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

          <Link href="/launch"
            className="hidden rounded-full bg-[linear-gradient(90deg,#00ff88,#00e5ff)] px-4 py-2 text-sm font-extrabold text-[#03110d] shadow-[0_12px_32px_rgba(0,255,136,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(0,255,136,0.25)] sm:inline-flex">
            Launch Token
          </Link>

          {walletArea}

          <button onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-xl border border-white/10 bg-white/[0.04] md:hidden"
            aria-label="Toggle menu">
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
                <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                  className={clsx("flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                    pathname === link.href
                      ? "bg-white/[0.08] text-white border-l-2 border-[#00ff88]"
                      : "text-white/60 hover:text-white hover:bg-white/[0.05]")}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}

      {/* Desktop install sheet */}
      {mounted && showInstallSheet && (
        <InstallSheet onClose={() => setShowInstallSheet(false)} />
      )}

      {/* Mobile "open in wallet" sheet */}
      {mounted && showMobileSheet && (
        <MobileWalletSheet onClose={() => setShowMobileSheet(false)} />
      )}
    </header>
  );
}
