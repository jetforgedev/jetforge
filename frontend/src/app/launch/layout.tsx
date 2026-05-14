import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Launch a Token — JetForge | JetForge",
  description: "Create and launch your own Solana token in under 30 seconds. No coding required. Fair launch with a bonding curve — no presales, no team allocations.",
  openGraph: {
    title: "Launch a Token — JetForge",
    description: "Launch your own Solana token in under 30 seconds. Fair launch, bonding curve, auto-graduation to Raydium.",
    url: "https://jetforge.io/launch",
    siteName: "JetForge",
    images: [{ url: "https://jetforge.io/og-image.jpg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Launch a Token — JetForge",
    description: "Launch your own Solana token in under 30 seconds. Fair launch, bonding curve, auto-graduation to Raydium.",
    images: ["https://jetforge.io/og-image.jpg"],
  },
  alternates: { canonical: "https://jetforge.io/launch" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="sr-only">Launch a Token on Solana — JetForge</h1>
      {children}
    </>
  );
}
