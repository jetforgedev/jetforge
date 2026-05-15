import type { Metadata } from "next";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is JetForge?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "JetForge is a decentralized token launchpad on Solana. Anyone can create a token with a bonding curve — a smart contract that automatically sets the price based on supply and demand. No presales, no VC allocations. Fair launch for everyone.",
      },
    },
    {
      "@type": "Question",
      name: "How does the bonding curve work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "JetForge uses a constant product formula (x * y = k). As more people buy, the price increases. As people sell, the price decreases. The curve starts at a low price and rises as the market cap grows toward the graduation threshold.",
      },
    },
    {
      "@type": "Question",
      name: "What does it cost to launch a token on JetForge?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Creating a token costs approximately 0.025 SOL in Solana rent fees for the mint account, bonding curve state, token vaults, and metadata. This is a one-time cost paid to the Solana network, not to JetForge.",
      },
    },
    {
      "@type": "Question",
      name: "What happens when a token graduates?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When a token raises enough SOL on the bonding curve, it graduates to a DEX such as Raydium or Orca. The SOL and reserve tokens are used to create a permanent liquidity pool. Trading continues on the DEX at market price.",
      },
    },
  ],
};


const breadcrumbJsonLd_FAQ = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "JetForge", item: "https://jetforge.io" },
    { "@type": "ListItem", position: 2, name: "FAQ", item: "https://jetforge.io/faq" },
  ],
};

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers to common questions about JetForge: how bonding curves work, token launch costs, graduation to DEX, trading fees, and Solana wallet setup.",
  alternates: { canonical: "https://jetforge.io/faq" },
  openGraph: {
    type: "website",
    url: "https://jetforge.io/faq",
    title: "Frequently Asked Questions",
    description: "Answers to common questions about JetForge: how bonding curves work, token launch costs, graduation to DEX, and trading fees.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "JetForge FAQ" }],
    siteName: "JetForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frequently Asked Questions",
    description: "Answers to common questions about JetForge: bonding curves, token launch costs, graduation, and fees.",
    images: ["/og-image.jpg"],
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd)
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/&/g, "\\u0026"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd_FAQ)
            .replace(/</g, "\u003c")
            .replace(/>/g, "\u003e")
            .replace(/&/g, "\u0026"),
        }}
      />
      {children}
    </>
  );
}
