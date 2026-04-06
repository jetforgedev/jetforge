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
    <header className="sticky top-0 z-50 border-b border-[#1a1a1a] bg-[#0a0a0a]/95 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-[#00ff88] flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z"
                fill="#000"
                stroke="#000"
                strokeWidth="0.5"
              />
              <path d="M8 5L11 6.5V9.5L8 11L5 9.5V6.5L8 5Z" fill="#00ff88" />
            </svg>
          </div>
          <span className="font-bold text-lg text-white tracking-tight">
            Jet<span className="text-[#00ff88]">Forge</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-[#00ff8815] text-[#00ff88]"
                  : "text-[#888] hover:text-white hover:bg-[#1a1a1a]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Wallet SOL Balance */}
          {publicKey && walletBalance !== null && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#111] border border-[#222] rounded-md">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">◎</span>
              </div>
              <span className="text-xs font-mono font-medium text-white">
                {walletBalance.toFixed(3)} SOL
              </span>
            </div>
          )}

          {/* Wallet Button */}
          <WalletMultiButton
            style={{
              height: "36px",
              fontSize: "13px",
              padding: "0 14px",
              borderRadius: "8px",
              background: "#00ff88",
              color: "#000",
              fontWeight: 600,
            }}
          />
        </div>
      </div>
    </header>
  );
}
