"use client";

import dynamic from "next/dynamic";
import { QueryClientWrapper } from "./QueryClientWrapper";

const AppWalletProvider = dynamic(
  () => import("@/providers/WalletProvider").then((m) => m.AppWalletProvider),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppWalletProvider>
      <QueryClientWrapper>{children}</QueryClientWrapper>
    </AppWalletProvider>
  );
}
