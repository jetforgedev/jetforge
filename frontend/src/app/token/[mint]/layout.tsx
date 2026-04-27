import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const BASE_URL = "https://app.jetforge.io";

interface Props {
  params: Promise<{ mint: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: { params: Promise<{ mint: string }> }): Promise<Metadata> {
  const { mint } = await params;

  try {
    const res = await fetch(`${API_URL}/tokens/${mint}`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error("not found");
    const token = await res.json();

    const title = `${token.name} (${token.symbol}) — Trade on JetForge`;
    const description = `Trade ${token.name} ($${token.symbol}) on JetForge. Market cap: ${Number(token.marketCapSol).toFixed(2)} SOL. ${token.isGraduated ? "Graduated to DEX." : `Bonding curve ${Math.min(100, token.graduationProgress).toFixed(1)}% complete.`} ${token.description ? token.description.slice(0, 120) : ""}`.trim();
    const image = token.imageUrl || "/opengraph-image";

    return {
      title,
      description,
      keywords: [token.name, token.symbol, "Solana token", "meme coin", "JetForge", "bonding curve", "trade"],
      openGraph: {
        type: "website",
        url: `${BASE_URL}/token/${mint}`,
        title,
        description,
        images: [{ url: image, width: 1200, height: 630, alt: `${token.name} on JetForge` }],
        siteName: "JetForge",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
      alternates: { canonical: `${BASE_URL}/token/${mint}` },
    };
  } catch {
    return {
      title: "Token — JetForge",
      description: "Trade Solana tokens on JetForge, the fair-launch bonding curve platform.",
    };
  }
}

export default async function TokenLayout({ children, params }: Props) {
  const { mint } = await params;
  let tokenJsonLd: object | null = null;

  try {
    const res = await fetch(`${API_URL}/tokens/${mint}`, { next: { revalidate: 60 } });
    if (res.ok) {
      const token = await res.json();
      tokenJsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: `${token.name} (${token.symbol})`,
        description: token.description || `${token.name} is a Solana token trading on JetForge bonding curve.`,
        url: `${BASE_URL}/token/${mint}`,
        image: token.imageUrl || `${BASE_URL}/opengraph-image`,
        brand: { "@type": "Brand", name: "JetForge" },
        offers: {
          "@type": "Offer",
          priceCurrency: "SOL",
          price: token.marketCapSol,
          availability: token.isGraduated
            ? "https://schema.org/Discontinued"
            : "https://schema.org/InStock",
          url: `${BASE_URL}/token/${mint}`,
        },
      };
    }
  } catch {}

  return (
    <>
      {tokenJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
          __html: JSON.stringify(tokenJsonLd)
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/&/g, "\\u0026"),
        }}
        />
      )}
      {children}
    </>
  );
}
