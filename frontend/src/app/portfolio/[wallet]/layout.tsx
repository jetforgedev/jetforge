import type { Metadata } from "next";

const BASE_URL = "https://jetforge.io";

interface Props {
  params: Promise<{ wallet: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: { params: Promise<{ wallet: string }> }): Promise<Metadata> {
  const { wallet } = await params;
  const short = wallet.slice(0, 6) + "..." + wallet.slice(-4);
  const title = `Portfolio ${short} — JetForge`;
  const description = `View trading portfolio and token holdings for wallet ${short} on JetForge, Solana’s fair-launch token platform.`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `${BASE_URL}/portfolio/${wallet}` },
  };
}

export default function PortfolioLayout({ children }: Props) {
  return <>{children}</>;
}
