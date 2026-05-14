import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard — Top Tokens on JetForge | JetForge",
  description: "Browse the top trending, recently launched, and graduated tokens on JetForge. Real-time Solana token leaderboard.",
  openGraph: {
    title: "Leaderboard — Top Tokens on JetForge",
    description: "Discover trending Solana tokens on JetForge's live leaderboard.",
    url: "https://jetforge.io/leaderboard",
    siteName: "JetForge",
    images: [{ url: "https://jetforge.io/og-image.jpg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Leaderboard — Top Tokens on JetForge",
    description: "Discover trending Solana tokens on JetForge's live leaderboard.",
    images: ["https://jetforge.io/og-image.jpg"],
  },
  alternates: { canonical: "https://jetforge.io/leaderboard" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="sr-only">Leaderboard — Top Tokens on JetForge</h1>
      {children}
    </>
  );
}
