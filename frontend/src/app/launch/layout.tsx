import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Launch a Token — JetForge",
  description: "Create and launch your own Solana token in minutes. No presales, no team allocations. 100% fair launch with a transparent bonding curve on JetForge.",
  alternates: { canonical: "https://jetforge.io/launch" },
  openGraph: {
    type: "website",
    url: "https://jetforge.io/launch",
    title: "Launch a Token — JetForge",
    description: "Create and launch your own Solana token in minutes. No presales, no team allocations. 100% fair launch with a transparent bonding curve on JetForge.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Launch a token on JetForge" }],
    siteName: "JetForge",
  },
  twitter: {
    card: "summary_large_image",
    title: "Launch a Token — JetForge",
    description: "Create and launch your own Solana token in minutes. 100% fair launch on JetForge.",
    images: ["/og-image.jpg"],
  },
};

export default function LaunchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
