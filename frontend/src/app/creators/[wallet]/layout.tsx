import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const BASE_URL = "https://jetforge.io";

interface Props {
  params: Promise<{ wallet: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: { params: Promise<{ wallet: string }> }): Promise<Metadata> {
  const { wallet } = await params;
  const short = wallet.slice(0, 6) + "..." + wallet.slice(-4);

  try {
    const res = await fetch(`${API_URL}/creators/${wallet}`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error("not found");
    const creator = await res.json();

    const name = creator.username || short;
    const tokenCount = creator.tokenCount ?? 0;
    const title = `${name} — Creator Profile on JetForge`;
    const description = `View ${name}'s creator profile on JetForge. ${tokenCount} token${tokenCount !== 1 ? "s" : ""} launched on Solana’s fair-launch bonding curve platform.`;

    return {
      title,
      description,
      alternates: { canonical: `${BASE_URL}/creators/${wallet}` },
      openGraph: {
        type: "profile",
        url: `${BASE_URL}/creators/${wallet}`,
        title,
        description,
        images: creator.avatarUrl
          ? [{ url: creator.avatarUrl, width: 400, height: 400, alt: `${name} avatar` }]
          : [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "JetForge Creator" }],
        siteName: "JetForge",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: creator.avatarUrl ? [creator.avatarUrl] : ["/og-image.jpg"],
      },
    };
  } catch {
    return {
      title: `Creator ${short} — JetForge`,
      description: `View this creator's launched tokens and activity on JetForge, Solana’s fair-launch token platform.`,
      alternates: { canonical: `${BASE_URL}/creators/${wallet}` },
    };
  }
}

export default function CreatorWalletLayout({ children }: Props) {
  return <>{children}</>;
}
