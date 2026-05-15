import type { Metadata } from "next";


const breadcrumbJsonLd_Launch = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "JetForge", item: "https://jetforge.io" },
    { "@type": "ListItem", position: 2, name: "Launch", item: "https://jetforge.io/launch" },
  ],
};

export const metadata: Metadata = {
  title: "Launch a Token on Solana",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd_Launch).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"),
        }}
      />
      <h1 className="sr-only">Launch a Token on Solana — JetForge</h1>
      {children}
    </>
  );
}
