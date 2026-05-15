import { MetadataRoute } from "next";

const BASE_URL = "https://jetforge.io";

async function fetchTokenMints(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/tokens?sort=new&limit=200&page=1`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tokens ?? []).map((t: any) => t.mint);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const mints = await fetchTokenMints();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                                              lastModified: new Date(), changeFrequency: "always",  priority: 1.0 },
    { url: `${BASE_URL}/launch`,                                  lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/leaderboard`,                             lastModified: new Date(), changeFrequency: "hourly",  priority: 0.8 },
    { url: `${BASE_URL}/creators`,                                lastModified: new Date(), changeFrequency: "hourly",  priority: 0.7 },
    { url: `${BASE_URL}/about`,                                   lastModified: new Date("2025-05-15"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/blog`,                                    lastModified: new Date("2025-05-15"), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/blog/jetforge-vs-pumpfun`,                lastModified: new Date("2025-05-15"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/blog/how-to-launch-a-token-on-solana`,    lastModified: new Date("2025-05-15"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/faq`,                                     lastModified: new Date("2025-05-15"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/support`,                                 lastModified: new Date("2025-05-15"), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/terms`,                                   lastModified: new Date("2025-05-15"), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/disclaimer`,                              lastModified: new Date("2025-05-15"), changeFrequency: "yearly",  priority: 0.3 },
  ];

  const tokenRoutes: MetadataRoute.Sitemap = mints.map((mint) => ({
    url: `${BASE_URL}/token/${mint}`,
    lastModified: new Date(),
    changeFrequency: "always" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...tokenRoutes];
}