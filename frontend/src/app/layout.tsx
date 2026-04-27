import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "./ClientProviders";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "react-hot-toast";

const BASE_URL = "https://app.jetforge.io";
const DEFAULT_TITLE = "JetForge — The Fair-Launch Token Platform on Solana";
const DEFAULT_DESCRIPTION =
  "Launch and trade tokens on Solana's most transparent bonding curve launchpad. No presales, no team allocations. 100% fair launch.";

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
  verification: {
    google: "qjR6nw1wpX7JF53x3mseMZVH-GgjhZNAsBUVyQlvtpA",
  },
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
    // og:image is injected automatically from app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    // twitter:image is injected automatically from app/opengraph-image.tsx
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
        <link rel="me" href={BASE_URL} />
      </head>
      <body className="min-h-screen bg-[#07110f] text-white" suppressHydrationWarning>
        <ClientProviders>
          <div className="relative min-h-screen overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(circle_at_top,rgba(0,255,136,0.10),transparent_58%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px] bg-[linear-gradient(180deg,rgba(0,204,255,0.08),transparent)]" />
            <Header />
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
