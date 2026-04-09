"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { TokenCard } from "@/components/TokenCard";
import { LiveFeed } from "@/components/LiveFeed";
import { getTokens, getTopTokens, getPlatformStats, TokenData } from "@/lib/api";
import { clsx } from "clsx";
import Link from "next/link";
import Image from "next/image";
import { useSocket } from "@/hooks/useLiveFeed";

type SortTab = "trending" | "new" | "graduating" | "graduated" | "watchlist";

const TAB_CONFIG = [
  { key: "trending" as SortTab, label: "🔥 Trending" },
  { key: "new" as SortTab, label: "🆕 New" },
  { key: "graduating" as SortTab, label: "📈 Graduating" },
  { key: "graduated" as SortTab, label: "🎓 Graduated" },
  { key: "watchlist" as SortTab, label: "⭐ Watchlist" },
];

function CountUpValue({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    setDisplay(value);
    const numeric = Number(value.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(numeric)) return;

    const suffix = value.replace(/[0-9.,]/g, "");
    const duration = 700;
    const steps = 18;
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep += 1;
      const next = (numeric * currentStep) / steps;
      const formatted = value.includes(".")
        ? next.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : Math.round(next).toLocaleString();
      setDisplay(`${formatted}${suffix}`);
      if (currentStep >= steps) {
        clearInterval(timer);
        setDisplay(value);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{display}</span>;
}

function StatsBar() {
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: getPlatformStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: graduatingData } = useQuery({
    queryKey: ["tokens-graduating-count"],
    queryFn: () => getTokens("graduating", 1, 1),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const graduatingCount = graduatingData?.pagination?.total ?? 0;

  const items = [
    {
      label: "Total Tokens",
      value: stats?.totalTokens?.toLocaleString() ?? "—",
      note: "launched on JetForge",
      badge: <><span className="live-dot mr-1" />Live</>,
    },
    {
      label: "24h Volume",
      value: stats ? `${stats.volume24hSol.toLocaleString()} SOL` : "—",
      note: "bonding curve activity",
      badge: "Momentum",
    },
    {
      label: "24h Trades",
      value: stats?.trades24h?.toLocaleString() ?? "—",
      note: "real-time market flow",
      badge: "Flow",
    },
  ];

  return (
    <div className="space-y-3">
      {graduatingCount > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.06] px-4 py-2.5 text-sm animate-pulse">
          <span className="text-yellow-400 font-semibold">📈 {graduatingCount} token{graduatingCount !== 1 ? "s" : ""} graduating right now — don't miss the launch!</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((s) => (
          <div
            key={s.label}
            className="glass-panel rounded-[24px] border border-white/10 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.22)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                {s.label}
              </span>
              <span className="text-xs text-[#00ff88] flex items-center">{s.badge}</span>
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-white sm:text-[1.9rem]">
              <CountUpValue value={s.value} />
            </div>
            <div className="mt-1 text-sm text-white/50">{s.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="glass-panel rounded-[24px] p-4 animate-pulse">
      <div className="mb-4 flex gap-3">
        <div className="h-14 w-14 rounded-2xl bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded-full bg-white/10" />
          <div className="h-3 w-1/2 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-2xl bg-white/10" />
        ))}
      </div>
      <div className="h-3 rounded-full bg-white/10" />
    </div>
  );
}

function KingOfTheHill() {
  const { data } = useQuery({
    queryKey: ["king-of-hill"],
    queryFn: () => getTopTokens("volume", 1),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const king = data?.[0];
  if (!king) return null;

  return (
    <Link href={`/token/${king.mint}`}>
      <div className="group relative overflow-hidden rounded-[28px] p-[1px]">
        <div className="absolute inset-0 animate-gradient-shift rounded-[28px] bg-[linear-gradient(115deg,rgba(255,207,90,0.9),rgba(255,255,255,0.2),rgba(255,207,90,0.95))]" />
        <div className="absolute inset-0 animate-shimmer rounded-[28px] bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.22),transparent)] opacity-40" />
        <div className="glass-panel-dark relative overflow-hidden rounded-[27px] border border-transparent px-5 py-5 transition-transform duration-200 group-hover:scale-[1.01] sm:px-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,207,90,0.18),transparent_70%)]" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(255,207,90,0.24),rgba(255,152,0,0.12))] text-3xl shadow-[0_0_28px_rgba(255,207,90,0.18)]">
                👑
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#ffcf5a]">
                  King of the Hill
                </div>
                <div className="mt-1 text-2xl font-extrabold tracking-tight text-white">
                  {king.name}
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-white/55">
                  <span className="font-mono text-white/70">${king.symbol}</span>
                  <span>rotates every hour</span>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-4">
              {king.imageUrl ? (
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10">
                  <Image src={king.imageUrl} alt={king.name} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ffcf5a]/15 text-lg font-bold text-[#ffcf5a]">
                  {king.symbol.slice(0, 2)}
                </div>
              )}
              <p className="max-w-xl text-sm leading-6 text-white/62">
                The highest-conviction chart on JetForge right now. Follow the strongest volume surge before it graduates.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">24H Volume</div>
                <div className="mt-2 text-lg font-bold text-white">{king.volume24h.toFixed(2)} SOL</div>
              </div>
              <div className="rounded-2xl border border-[#ffcf5a]/20 bg-[#ffcf5a]/8 p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#ffcf5a]/70">Market Cap</div>
                <div className="mt-2 text-lg font-bold text-[#fff1c2]">{king.marketCapSol.toFixed(2)} SOL</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jetforge_watchlist");
      if (saved) setWatchlist(JSON.parse(saved));
    } catch {}
  }, []);

  const toggle = useCallback((mint: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(mint) ? prev.filter((m) => m !== mint) : [...prev, mint];
      localStorage.setItem("jetforge_watchlist", JSON.stringify(next));
      return next;
    });
  }, []);

  return { watchlist, toggle };
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<SortTab>("trending");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { watchlist, toggle } = useWatchlist();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch]);

  const apiSort = activeTab === "watchlist" ? "new" : activeTab === "graduated" ? "graduated" : activeTab;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["tokens", apiSort, page, debouncedSearch],
    queryFn: () => getTokens(apiSort as any, page, 20, debouncedSearch || undefined),
    staleTime: 10_000,
    refetchInterval: 15_000,
    enabled: activeTab !== "watchlist",
  });

  const { data: watchlistData, isLoading: watchlistLoading } = useQuery({
    queryKey: ["tokens-watchlist", watchlist],
    queryFn: async () => {
      if (watchlist.length === 0) return { tokens: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
      const res = await getTokens("new", 1, 50);
      return { ...res, tokens: res.tokens.filter((t) => watchlist.includes(t.mint)) };
    },
    enabled: activeTab === "watchlist",
    staleTime: 15_000,
  });

  const rawTokens = activeTab === "watchlist" ? (watchlistData?.tokens ?? []) : (data?.tokens ?? []);
  const tokens = rawTokens;
  const pagination = activeTab === "watchlist" ? watchlistData?.pagination : data?.pagination;
  const loading = activeTab === "watchlist" ? watchlistLoading : isLoading;

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(0,255,136,0.12),rgba(255,255,255,0.03)_35%,rgba(0,204,255,0.12))] px-5 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:px-8 sm:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(0,255,136,0.14),transparent_24%)]" />
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)", backgroundSize: "42px 42px" }} />
          <div className="relative grid gap-7 lg:grid-cols-[1.45fr_0.9fr] lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00ff88]/20 bg-[#00ff88]/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#86ffc4]">
                <span className="live-dot" />
                Fair-launch momentum on Solana
              </div>
              <h1 className="max-w-2xl text-4xl font-extrabold leading-none tracking-[-0.04em] text-white sm:text-5xl lg:text-[4.2rem]">
                The Fairest Token Launch on Solana
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                Launch fast, trade instantly, and ride the bonding curve before everyone else. No presales, no insider allocations, just transparent price discovery and pure FOMO.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/launch"
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#00ff88_0%,#00e5ff_100%)] px-6 py-3.5 text-sm font-extrabold text-[#03110d] shadow-[0_16px_40px_rgba(0,255,136,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(0,255,136,0.3)]"
                >
                  Forge a Token
                </Link>
                <Link
                  href="#market"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white/78 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                >
                  Explore Live Market
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ["Zero presales", "Pure public discovery from the first trade"],
                ["Real-time rotation", "Fresh trending charts every few seconds"],
                ["Auto graduation", "Liquidity progresses toward DEX migration"],
              ].map(([title, desc], index) => (
                <div
                  key={title}
                  className={clsx(
                    "glass-panel rounded-[24px] p-4 text-sm text-white/65",
                    index === 0 && "animate-float"
                  )}
                >
                  <div className="text-sm font-bold text-white">{title}</div>
                  <div className="mt-1 leading-6">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <StatsBar />

        <KingOfTheHill />

        <section id="market" className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                Live Discovery
              </div>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Find the next chart before it breaks out
              </h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1 sm:min-w-[280px]">
                <input
                  type="text"
                  placeholder="Search tokens, symbols, creators..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 pl-11 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-4 focus:ring-[#00ff88]/10"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35">🔍</span>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-white/45 transition-colors hover:text-white/75"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <div className="flex w-max min-w-full items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-sm sm:w-fit">
                  {TAB_CONFIG.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={clsx(
                        "relative shrink-0 rounded-[14px] px-3 py-2 text-sm font-semibold transition-all sm:px-4 sm:py-2.5",
                        activeTab === tab.key
                          ? "bg-white/[0.08] text-white shadow-[inset_0_-2px_0_0_#00ff88,0_8px_20px_rgba(0,255,136,0.08)]"
                          : "text-white/45 hover:text-white/75"
                      )}
                    >
                      {tab.key === "watchlist"
                        ? `⭐ Watchlist${watchlist.length > 0 ? ` (${watchlist.length})` : ""}`
                        : tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : tokens.length === 0 ? (
            <div className="glass-panel flex flex-col items-center justify-center rounded-[28px] px-6 py-24 text-center text-white/40">
              {activeTab === "watchlist" ? (
                <>
                  <div className="mb-4 text-5xl">⭐</div>
                  <div className="text-xl font-semibold text-white/70">No tokens starred yet</div>
                  <div className="mt-2 text-sm text-white/45">Add anything promising to your watchlist and it will show up here.</div>
                </>
              ) : debouncedSearch ? (
                <>
                  <div className="mb-4 text-5xl">🔍</div>
                  <div className="text-xl font-semibold text-white/70">No results for "{debouncedSearch}"</div>
                </>
              ) : (
                <>
                  <div className="mb-4 text-5xl">🚀</div>
                  <div className="text-xl font-semibold text-white/70">No tokens live yet</div>
                  <div className="mt-2 text-sm">
                    Be the first to{" "}
                    <a href="/launch" className="font-semibold text-[#00ff88] hover:underline">launch a token</a>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div
                className={clsx(
                  "grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                  isFetching && "opacity-85 transition-opacity"
                )}
              >
                {tokens.map((token: TokenData) => (
                  <TokenCard
                    key={token.mint}
                    token={token}
                    isWatched={watchlist.includes(token.mint)}
                    onWatchToggle={() => toggle(token.mint)}
                  />
                ))}
              </div>

              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-white/45">
                    {page} / {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page >= pagination.pages}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <div className="hidden w-80 shrink-0 lg:block">
        <div className="sticky top-24">
          <LiveFeed />
        </div>
      </div>

      <Link
        href="/launch"
        className="fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#00ff88,#00e5ff)] px-5 py-3 text-sm font-extrabold text-[#03110d] shadow-[0_18px_40px_rgba(0,255,136,0.28)] transition-all hover:-translate-y-0.5 lg:hidden sm:right-6"
      >
        <span className="text-base">🚀</span>
        Launch Token
      </Link>
    </div>
  );
}
