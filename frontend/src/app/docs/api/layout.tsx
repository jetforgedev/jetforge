import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "API Reference — JetForge Public REST API v1",
  description:
    "JetForge Public REST API v1. Integrate live bonding curve markets, real-time quotes, and unsigned trade transactions into your app or trading bot. No API key required.",
  alternates: { canonical: "https://jetforge.io/docs/api" },
  openGraph: {
    type: "website",
    url: "https://jetforge.io/docs/api",
    title: "JetForge API Reference — Public REST API v1",
    description:
      "Fetch live market data, get trade quotes, and prepare unsigned Solana transactions from the JetForge bonding curve. Free, no auth required.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "JetForge API Docs" }],
    siteName: "JetForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "JetForge API Reference",
    description:
      "Public REST API for JetForge bonding curve markets. Real-time quotes, market data, and unsigned transactions.",
    images: ["/og-image.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
