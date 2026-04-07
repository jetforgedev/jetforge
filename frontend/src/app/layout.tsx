import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "./ClientProviders";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "react-hot-toast";

const BASE_URL = "https://jetforge.io";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "JetForge — Fair-Launch Solana Token Platform",
    template: "%s | JetForge",
  },
  description:
    "Launch and trade Solana meme coins instantly with a bonding curve. No presales, no team allocations — 100% fair launch. Real-time charts, live trading, and automatic DEX graduation.",
  keywords: [
    "Solana token launch",
    "pump fun alternative",
    "bonding curve",
    "Solana meme coin",
    "fair launch crypto",
    "SPL token creator",
    "Solana DeFi",
    "token launchpad",
    "JetForge",
    "crypto trading",
  ],
  authors: [{ name: "JetForge", url: BASE_URL }],
  creator: "JetForge",
  publisher: "JetForge",
  category: "Finance",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "JetForge",
    title: "JetForge — Fair-Launch Solana Token Platform",
    description:
      "Launch your own Solana token in seconds. Trade with a bonding curve, no presales, no rugs. Real-time charts and live trading.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "JetForge — Solana Token Launchpad" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "JetForge — Fair-Launch Solana Token Platform",
    description: "Launch and trade Solana tokens instantly. Bonding curve, fair launch, real-time charts.",
    images: ["/og-image.png"],
    creator: "@jetforgeio",
  },
  alternates: {
    canonical: BASE_URL,
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "JetForge",
  url: BASE_URL,
  description:
    "Fair-launch Solana token launchpad. Launch meme coins, trade with bonding curve, graduate to DEX.",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${BASE_URL}/?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "JetForge",
  url: BASE_URL,
  logo: `${BASE_URL}/icon.png`,
  sameAs: [],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <link rel="me" href={BASE_URL} />
      </head>
      <body className="bg-[#0a0a0a] text-white min-h-screen" suppressHydrationWarning>
        <ClientProviders>
          <Header />
          <main className="max-w-[1400px] mx-auto px-4 py-6">
            {children}
          </main>
          <Footer />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#1a1a1a",
                color: "#fff",
                border: "1px solid #2a2a2a",
                borderRadius: "10px",
                fontSize: "13px",
              },
              success: { iconTheme: { primary: "#00ff88", secondary: "#000" } },
              error: { iconTheme: { primary: "#ff4444", secondary: "#fff" } },
            }}
          />
        </ClientProviders>
      </body>
    </html>
  );
}
