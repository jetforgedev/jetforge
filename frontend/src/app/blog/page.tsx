import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Blog — Solana Token Launchpad Guides",
  description:
    "Guides, comparisons, and tutorials about launching and trading Solana tokens on JetForge. Learn how bonding curves work, how to launch a fair-launch token, and how JetForge compares to other platforms.",
  alternates: { canonical: "https://jetforge.io/blog" },
  openGraph: {
    type: "website",
    url: "https://jetforge.io/blog",
    title: "JetForge Blog — Solana Token Guides",
    description: "Tutorials and guides for launching and trading Solana tokens.",
    siteName: "JetForge",
  },
};

const posts = [
  {
    slug: "how-to-launch-a-token-on-solana",
    title: "How to Launch a Token on Solana in Under 60 Seconds",
    desc: "A step-by-step guide to creating and launching your own Solana SPL token using JetForge's fair-launch bonding curve. No coding required.",
    tag: "Guide",
    readTime: "5 min read",
  },
  {
    slug: "jetforge-vs-pumpfun",
    title: "JetForge vs pump.fun: Which Solana Launchpad Should You Use?",
    desc: "An honest side-by-side comparison of JetForge and pump.fun — fees, features, graduation thresholds, creator earnings, and anti-rug tools.",
    tag: "Comparison",
    readTime: "6 min read",
  },
];

export default function BlogPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-10">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#00ff88]/18 bg-[#00ff88]/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8dffc9]">
          Resources
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Blog</h1>
        <p className="text-white/55 leading-7">
          Guides and tutorials for launching and trading Solana tokens on JetForge.
        </p>
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block rounded-2xl border border-white/8 bg-white/[0.025] p-6 hover:border-white/15 hover:bg-white/[0.04] transition-all group"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#00ff88] bg-[#00ff8810] border border-[#00ff8825] rounded-full px-2.5 py-1">
                {post.tag}
              </span>
              <span className="text-[11px] text-white/30">{post.readTime}</span>
            </div>
            <h2 className="text-lg font-bold text-white group-hover:text-[#00ff88] transition-colors leading-snug">
              {post.title}
            </h2>
            <p className="mt-2 text-sm text-white/50 leading-6">{post.desc}</p>
            <div className="mt-4 text-xs text-[#00ff88] font-medium">Read article →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
