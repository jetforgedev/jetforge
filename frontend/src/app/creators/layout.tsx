import type { Metadata } from "next";


const breadcrumbJsonLd_Creators = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "JetForge", item: "https://jetforge.io" },
    { "@type": "ListItem", position: 2, name: "Creators", item: "https://jetforge.io/creators" },
  ],
};

export const metadata: Metadata = {
  title: "Token Creators",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd_Creators).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"),
        }}
      />
      <h1 className="sr-only">Token Creators — JetForge</h1>
      {children}
    </>
  );
}
