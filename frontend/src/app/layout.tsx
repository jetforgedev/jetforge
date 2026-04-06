import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "./ClientProviders";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "JetForge - Launch & Trade Solana Tokens",
  description:
    "Launch your own Solana token and trade with a bonding curve. Fair-launch platform on Solana with real-time price discovery.",
  keywords: ["Solana", "token launch", "bonding curve", "DeFi", "meme coins"],
  openGraph: {
    title: "JetForge - Launch & Trade Solana Tokens",
    description: "Launch and trade Solana tokens with a bonding curve",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
              success: {
                iconTheme: { primary: "#00ff88", secondary: "#000" },
              },
              error: {
                iconTheme: { primary: "#ff4444", secondary: "#fff" },
              },
            }}
          />
        </ClientProviders>
      </body>
    </html>
  );
}
