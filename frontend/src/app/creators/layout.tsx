import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token Creators — JetForge | JetForge",
  description: "Explore token creators on JetForge. See who is launching Solana tokens, their stats, and their token portfolios.",
  openGraph: {
    title: "Token Creators — JetForge",
    description: "Discover Solana token creators on JetForge — their launches, stats, and performance.",
    url: "https://jetforge.io/creators",
    siteName: "JetForge",
    images: [{ url: "https://jetforge.io/og-image.jpg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Token Creators — JetForge",
    description: "Discover Solana token creators on JetForge — their launches, stats, and performance.",
    images: ["https://jetforge.io/og-image.jpg"],
  },
  alternates: { canonical: "https://jetforge.io/creators" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="sr-only">Token Creators — JetForge</h1>
      {children}
    </>
  );
}
