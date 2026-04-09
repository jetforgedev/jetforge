"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { clsx } from "clsx";

export function Header() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

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
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_0_25px_rgba(0,255,136,0.12)]">
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle,rgba(0,255,136,0.18),transparent_68%)] opacity-80 transition-opacity group-hover:opacity-100" />
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 2 C15 2 22 8 22 16 L15 28 L8 16 C8 8 15 2 15 2Z" fill="#00ff88" />
              <circle cx="15" cy="13" r="3" fill="#07110f" />
              <circle cx="15" cy="13" r="1.4" fill="#00ccff" opacity="0.8" />
              <path d="M8 16 L4 21 L8 19Z" fill="#00ccff" />
              <path d="M22 16 L26 21 L22 19Z" fill="#00ccff" />
              <path d="M12.5 26 L15 31 L17.5 26Z" fill="#ff8a00" opacity="0.9" />
              <path d="M13.8 25 L15 29 L16.2 25Z" fill="#ffcf5a" opacity="0.75" />
            </svg>
          </div>
          <div className="leading-none">
            <div className="bg-[linear-gradient(90deg,#00ff88,#00ccff)] bg-clip-text text-[17px] font-black tracking-tight text-transparent sm:text-[19px]">
              JetForge
            </div>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/35">
              Solana Launchpad
            </div>
          </div>
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
        </div>
      </div>
    </header>
  );
}
