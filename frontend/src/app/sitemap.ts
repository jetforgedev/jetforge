import { MetadataRoute } from "next";

const BASE_URL = "https://jetforge.io";
const API_URL = process.env.NEXT_PUBLIC_API_URL || `${BASE_URL}/api`;

async function fetchCreatorWallets(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/creators?metric=volume&limit=50`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = Array.isArray(data) ? data : data.creators ?? [];
    return rows
      .map((c: any) => c.wallet ?? c.creator)
      .filter((w: unknown): w is string => typeof w === "string" && w.length > 0);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const creators = await fetchCreatorWallets();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                                                            lastModified: new Date(), changeFrequency: "always",  priority: 1.0 },
    { url: `${BASE_URL}/launch`,                                                lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/leaderboard`,                                           lastModified: new Date(), changeFrequency: "hourly",  priority: 0.8 },
    { url: `${BASE_URL}/creators`,                                              lastModified: new Date(), changeFrequency: "hourly",  priority: 0.7 },
    { url: `${BASE_URL}/referral`,                                              lastModified: new Date("2026-05-20"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/about`,                                                 lastModified: new Date("2026-05-16"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/blog`,                                                  lastModified: new Date("2026-05-20"), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/blog/jetforge-vs-pumpfun`,                              lastModified: new Date("2026-05-16"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/blog/what-is-a-bonding-curve`,                         lastModified: new Date("2026-05-16"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/blog/how-to-launch-a-token-on-solana`,                  lastModified: new Date("2026-05-16"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/blog/jetforge-referral-program`,                        lastModified: new Date("2026-05-20"), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/blog/best-pumpfun-alternatives`,                        lastModified: new Date("2026-05-29"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/blog/how-to-avoid-solana-rug-pulls`,                    lastModified: new Date("2026-05-29"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/blog/what-is-an-spl-token`,                             lastModified: new Date("2026-05-29"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/blog/solana-meme-coin-guide`,                           lastModified: new Date("2026-05-29"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/blog/best-solana-token-launchpads-2026`,                lastModified: new Date("2026-05-29"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/faq`,                                                   lastModified: new Date("2026-05-16"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/support`,                                               lastModified: new Date("2026-05-16"), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/terms`,                                                 lastModified: new Date("2026-05-16"), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/disclaimer`,                                            lastModified: new Date("2026-05-16"), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/privacy`,                                               lastModified: new Date("2026-05-16"), changeFrequency: "yearly" as const,  priority: 0.3 },
    { url: `${BASE_URL}/press`,                                                 lastModified: new Date("2026-05-16"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/docs/api`,                                              lastModified: new Date("2026-05-24"), changeFrequency: "monthly", priority: 0.7 },
  ];

  const creatorRoutes: MetadataRoute.Sitemap = creators.map((wallet) => ({
    url: `${BASE_URL}/creators/${wallet}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...creatorRoutes];
}
