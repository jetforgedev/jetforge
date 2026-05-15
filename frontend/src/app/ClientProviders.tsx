"use client";

import { MountedWalletProvider } from "@/providers/MountedWalletProvider";
import { QueryClientWrapper } from "./QueryClientWrapper";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <MountedWalletProvider>
      <QueryClientWrapper>{children}</QueryClientWrapper>
    </MountedWalletProvider>
  );
}

