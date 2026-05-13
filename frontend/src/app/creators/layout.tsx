import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token Creators — JetForge",
  description: "Discover the top token creators on JetForge, Solana’s fair-launch bonding curve launchpad. Browse creator profiles, launched tokens, and performance stats.",
  alternates: { canonical: "https://jetforge.io/creators" },
  openGraph: {
    type: "website",
    url: "https://jetforge.io/creators",
    title: "Token Creators — JetForge",
    description: "Discover the top token creators on JetForge, Solana’s fair-launch bonding curve launchpad. Browse creator profiles, launched tokens, and performance stats.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "JetForge Creators" }],
    siteName: "JetForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "Token Creators — JetForge",
    description: "Discover the top token creators on JetForge, Solana’s fair-launch bonding curve launchpad.",
    images: ["/og-image.jpg"],
  },
};

export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
