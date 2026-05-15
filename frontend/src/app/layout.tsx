import type { Metadata } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});
import { ClientProviders } from "./ClientProviders";
import { HeaderClient } from "@/components/HeaderClient";
import { Footer } from "@/components/Footer";
import { Toaster } from "react-hot-toast";

const BASE_URL = "https://jetforge.io";
const DEFAULT_TITLE = "JetForge — Fair-Launch Solana Token Launchpad | Launch in 60 Seconds";
const DEFAULT_DESCRIPTION =
  "Launch your Solana token or meme coin in 60 seconds — no code needed. JetForge is the fair-launch bonding curve launchpad with whale alerts, real-time charts, and auto-graduation to Raydium.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | JetForge",
  },
  description: DEFAULT_DESCRIPTION,
  icons: {
    icon: [
      { url: "/brand/jetforge-favicon.png", type: "image/png", sizes: "any" },
    ],
    shortcut: "/brand/jetforge-favicon.png",
    apple: "/brand/jetforge-favicon.png",
  },
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
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "JetForge — Solana fair-launch platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/og-image.jpg"],
    creator: "@jetforgeDev",
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
  description: DEFAULT_DESCRIPTION,
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${BASE_URL}/token/{search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "JetForge",
  url: BASE_URL,
  logo: "https://jetforge.io/logo.png",
  description: "Fair-launch bonding curve token launchpad on Solana",
  sameAs: [
    "https://twitter.com/JetForgeIO",
    "https://github.com/jetforgeio",
    "https://www.wikidata.org/wiki/Q139801889",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "itsdrsmith013@gmail.com",
    contactType: "customer support",
  },
};

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "JetForge",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  url: BASE_URL,
  description: "Fair-launch Solana token launchpad. Launch and trade SPL tokens with a bonding curve AMM — no presales, no team allocations. Auto-graduates to Raydium DEX at 85 SOL.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free to use. Token creation costs approximately 0.025 SOL in Solana network fees.",
  },
  featureList: [
    "Fair-launch bonding curve AMM",
    "Real-time OHLCV candlestick charts",
    "Live WebSocket trade feed",
    "Anti-rug score per token",
    "Auto-graduation to Raydium DEX at 85 SOL",
    "Portfolio tracker per wallet",
    "Creator leaderboard",
    "King of the Hill — top token by 24h volume",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/brand/jetforge-favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/brand/jetforge-favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/brand/jetforge-favicon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
        />
        <link rel="me" href={BASE_URL} />

        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CS8VS5VBHM"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CS8VS5VBHM');
          `}
        </Script>
      </head>
      <body className="min-h-screen bg-[#07110f] text-white" suppressHydrationWarning>
        <ClientProviders>
          <div className="relative min-h-screen overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(circle_at_top,rgba(0,255,136,0.10),transparent_58%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px] bg-[linear-gradient(180deg,rgba(0,204,255,0.08),transparent)]" />
            <HeaderClient />
            <main className="relative mx-auto max-w-[1560px] px-4 py-6 pb-6 sm:px-5 sm:pb-24 lg:px-6">
              {children}
            </main>
            <Footer />
          </div>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "rgba(9, 18, 16, 0.94)",
                color: "#f5fffb",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                fontSize: "13px",
                boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
                backdropFilter: "blur(18px)",
              },
              success: { iconTheme: { primary: "#00ff88", secondary: "#04110c" } },
              error: { iconTheme: { primary: "#ff5b6e", secondary: "#fff" } },
            }}
          />
        </ClientProviders>
      </body>
    </html>
  );
}