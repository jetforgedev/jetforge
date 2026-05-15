import type { Metadata } from "next";


const breadcrumbJsonLd_Leaderboard = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "JetForge", item: "https://jetforge.io" },
    { "@type": "ListItem", position: 2, name: "Leaderboard", item: "https://jetforge.io/leaderboard" },
  ],
};

export const metadata: Metadata = {
  title: "Leaderboard — Top Tokens",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd_Leaderboard).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"),
        }}
      />
      <h1 className="sr-only">Leaderboard — Top Tokens on JetForge</h1>
      {children}
    </>
  );
}
