import type { Metadata } from "next";
import FaqAccordion from "./FaqAccordion";

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: "FAQ — JetForge Help & Common Questions",
  description:
    "Answers to the most common questions about JetForge: how bonding curves work, token creation, fees, wallet support, graduation, and trading on Solana.",
  openGraph: {
    title: "FAQ — JetForge Help & Common Questions",
    description:
      "Everything you need to know about launching and trading tokens on JetForge.",
    url: "https://jetforge.io/faq",
    siteName: "JetForge",
    images: [{ url: "https://jetforge.io/og-image.jpg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ — JetForge Help & Common Questions",
    description: "Common questions about JetForge token launches on Solana.",
    images: ["https://jetforge.io/og-image.jpg"],
  },
  alternates: { canonical: "https://jetforge.io/faq" },
};

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Frequently Asked Questions
        </h1>
        <p className="text-[#555] text-sm">
          Everything you need to know about JetForge and Solana token launches.
        </p>
      </div>
      <FaqAccordion />
    </div>
  );
}
