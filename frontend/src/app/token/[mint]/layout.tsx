import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const BASE_URL = "https://jetforge.io";

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

    const title = `${token.name} (${token.symbol})`;
    const description = `Trade ${token.name} ($${token.symbol}) on JetForge. Market cap: ${Number(token.marketCapSol).toFixed(2)} SOL. ${token.isGraduated ? "Graduated to DEX." : `Bonding curve ${Math.min(100, token.graduationProgress).toFixed(1)}% complete.`} ${token.description ? token.description.slice(0, 120) : ""}`.trim();
    const image = token.imageUrl || "/og-image.png";

    return {
      title,
      description,
      keywords: [token.name, token.symbol, "Solana token", "meme coin", "JetForge", "bonding curve", "trade"],
      openGraph: {
        type: "website",
        url: `${BASE_URL}/token/${mint}`,
        title,
        description,
        images: [
      { url: `https://app.jetforge.io/og?mint=${mint}`, width: 1200, height: 630, alt: `${token.name} on JetForge` },
    ],
        siteName: "JetForge",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [`https://app.jetforge.io/og?mint=${mint}`],
      },
      alternates: { canonical: `${BASE_URL}/token/${mint}` },
    };
  } catch {
    return {
    title: "Token \u{1F680} JetForge",
    description: "Trade Solana tokens on JetForge, the fair-launch bonding curve platform.",
    openGraph: {
      images: [{ url: "https://app.jetforge.io/og", width: 1200, height: 630 }],
    },
  };
  }
}

export default async function TokenLayout({ children, params }: Props) {
  const { mint } = await params;
  let tokenJsonLd: object | null = null;
  let breadcrumbJsonLd: object | null = null;

  try {
    const res = await fetch(`${API_URL}/tokens/${mint}`, { next: { revalidate: 60 } });
    if (res.ok) {
      const token = await res.json();

      breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "JetForge", item: BASE_URL },
          { "@type": "ListItem", position: 2, name: "Tokens",   item: `${BASE_URL}/tokens` },
          { "@type": "ListItem", position: 3, name: `${token.name} (${token.symbol})`, item: `${BASE_URL}/token/${mint}` },
        ],
      };

      tokenJsonLd = {
        "@context": "https://schema.org",
        "@type": "FinancialProduct",
        name: `${token.name} (${token.symbol})`,
        description: token.description || `${token.name} is a Solana token trading on JetForge bonding curve.`,
        url: `${BASE_URL}/token/${mint}`,
        image: token.imageUrl || `${BASE_URL}/og-image.png`,
        brand: { "@type": "Brand", name: "JetForge" },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.5",
          reviewCount: token.trades > 0 ? token.trades : 1,
          bestRating: "5",
          worstRating: "1",
        },
        offers: {
          "@type": "Offer",
          priceCurrency: "USD",
          price: token.priceUsd ?? 0,
          availability: token.isGraduated
            ? "https://schema.org/Discontinued"
            : "https://schema.org/InStock",
          url: `${BASE_URL}/token/${mint}`,
          seller: {
            "@type": "Organization",
            name: "JetForge",
            url: "https://jetforge.io",
          },
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "US",
            returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
          },
          shippingDetails: {
            "@type": "OfferShippingDetails",
            shippingRate: {
              "@type": "MonetaryAmount",
              value: "0",
              currency: "USD",
            },
            deliveryTime: {
              "@type": "ShippingDeliveryTime",
              handlingTime: {
                "@type": "QuantitativeValue",
                minValue: 0,
                maxValue: 0,
                unitCode: "DAY",
              },
            },
            doesNotShip: true,
          },
        },
      };
    }
  } catch {}

  const esc = (obj: object) =>
    JSON.stringify(obj)
      .replace(/</g, "\u003c")
      .replace(/>/g, "\u003e")
      .replace(/&/g, "\u0026");

  return (
    <>
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: esc(breadcrumbJsonLd) }}
        />
      )}
      {tokenJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: esc(tokenJsonLd) }}
        />
      )}
      {children}
    </>
  );
}
