import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard — Top Tokens on JetForge",
  description: "See the top-performing tokens by volume, trades, and market cap on JetForge — Solana’s fair-launch bonding curve launchpad.",
  alternates: { canonical: "https://jetforge.io/leaderboard" },
  openGraph: {
    type: "website",
    url: "https://jetforge.io/leaderboard",
    title: "Leaderboard — Top Tokens on JetForge",
    description: "See the top-performing tokens by volume, trades, and market cap on JetForge — Solana’s fair-launch bonding curve launchpad.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "JetForge Leaderboard" }],
    siteName: "JetForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "Leaderboard — Top Tokens on JetForge",
    description: "See the top-performing tokens by volume, trades, and market cap on JetForge.",
    images: ["/og-image.jpg"],
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
