"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AppWalletProvider } from "@/providers/WalletProvider";

export function MountedWalletProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{children}</>;
  return <AppWalletProvider>{children}</AppWalletProvider>;
}

