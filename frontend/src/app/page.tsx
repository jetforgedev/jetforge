"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { TokenCard } from "@/components/TokenCard";
import { LiveFeed } from "@/components/LiveFeed";
import { getTokens, getTopTokens, getPlatformStats, TokenData } from "@/lib/api";
import { clsx } from "clsx";
import Link from "next/link";
import Image from "next/image";

type SortTab = "trending" | "new" | "graduating" | "graduated" | "watchlist";

const TAB_CONFIG = [
  { key: "trending" as SortTab, label: "Trending" },
  { key: "new" as SortTab, label: "New" },
  { key: "graduating" as SortTab, label: "Graduating" },
  { key: "graduated" as SortTab, label: "Graduated" },
  { key: "watchlist" as SortTab, label: "Watchlist" },
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

  const items = [
    { label: "Total Tokens", value: stats?.totalTokens?.toLocaleString() ?? "-", note: "launched on JetForge", badge: "Live" },
    { label: "24h Volume", value: stats ? `${stats.volume24hSol.toLocaleString()} SOL` : "-", note: "bonding curve activity", badge: "Momentum" },
    { label: "24h Trades", value: stats?.trades24h?.toLocaleString() ?? "-", note: "real-time market flow", badge: "Flow" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5 md:gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="glass-panel rounded-[14px] border border-white/10 px-3 py-3 shadow-[0_20px_45px_rgba(0,0,0,0.22)] md:rounded-[24px] md:p-5"
        >
          <div className="mb-1.5 flex items-start justify-between gap-1 md:mb-3 md:gap-3">
            <span className="text-[8px] font-semibold uppercase leading-tight tracking-[0.1em] text-white/40 md:text-[11px] md:tracking-[0.24em]">
              {item.label}
            </span>
            <span className="hidden shrink-0 rounded-full bg-[#00ff88]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00ff88] md:inline-flex">
              {item.badge}
            </span>
          </div>
          <div className="truncate text-sm font-extrabold tracking-tight text-white sm:text-base md:text-2xl">
            <CountUpValue value={item.value} />
          </div>
          <div className="mt-0.5 hidden text-sm text-white/50 md:block">{item.note}</div>
        </div>
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="glass-panel h-full rounded-[24px] p-4 animate-pulse">
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
  if (!king) {
    return (
      <div className="relative overflow-hidden rounded-[16px] border border-[#ffcf5a]/20 bg-[linear-gradient(135deg,rgba(255,207,90,0.08),rgba(255,255,255,0.02))] p-3 sm:rounded-[28px] sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#ffcf5a]/12 text-lg sm:h-14 sm:w-14 sm:rounded-2xl sm:text-2xl">
            👑
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#ffcf5a] sm:text-[11px] sm:tracking-[0.34em]">
              King of the Hill
            </div>
            <div className="mt-0.5 text-[13px] font-semibold text-white/70 sm:text-base">
              Waiting for a leader
            </div>
            <div className="mt-0.5 text-[11px] text-white/45 sm:text-sm">
              The top volume token will appear here automatically.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/token/${king.mint}`}>
      <div className="group relative overflow-hidden rounded-[16px] p-[1px] sm:rounded-[28px]">
        <div className="absolute inset-0 animate-gradient-shift rounded-[16px] bg-[linear-gradient(115deg,rgba(255,207,90,0.9),rgba(255,255,255,0.2),rgba(255,207,90,0.95))] sm:rounded-[28px]" />
        <div className="absolute inset-0 animate-shimmer rounded-[16px] bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.22),transparent)] opacity-40 sm:rounded-[28px]" />
        <div className="glass-panel-dark relative overflow-hidden rounded-[15px] border border-transparent px-3 py-3 transition-transform duration-200 group-hover:scale-[1.01] sm:rounded-[27px] sm:px-6 sm:py-5 lg:px-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,207,90,0.18),transparent_70%)]" />

          {/* ── Mobile layout ── */}
          <div className="flex items-center gap-3 sm:hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[linear-gradient(135deg,rgba(255,207,90,0.24),rgba(255,152,0,0.12))] text-lg shadow-[0_0_18px_rgba(255,207,90,0.18)]">
              👑
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#ffcf5a]">King of the Hill</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-white">{king.name}</span>
                <span className="shrink-0 text-[11px] font-mono text-white/50">${king.symbol}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[8px] uppercase tracking-[0.1em] text-white/35">Vol 24H</div>
              <div className="text-[13px] font-bold text-white">{king.volume24h.toFixed(0)} SOL</div>
              <div className="text-[8px] uppercase tracking-[0.1em] text-[#ffcf5a]/60">MCap</div>
              <div className="text-[12px] font-bold text-[#fff1c2]">{king.marketCapSol.toFixed(0)} SOL</div>
            </div>
          </div>

          {/* ── Desktop layout ── */}
          <div className="hidden gap-2.5 sm:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)] lg:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(255,207,90,0.24),rgba(255,152,0,0.12))] text-3xl shadow-[0_0_28px_rgba(255,207,90,0.18)]">
                  👑
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#ffcf5a]">King of the Hill</div>
                  <div className="mt-1 line-clamp-1 text-2xl font-extrabold leading-5 tracking-tight text-white">{king.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-white/55">
                    <span className="font-mono text-white/70">${king.symbol}</span>
                    <span>rotates every hour</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex min-w-0 items-start gap-4">
                {king.imageUrl ? (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10">
                    <Image src={king.imageUrl} alt={king.name} fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ffcf5a]/15 text-lg font-bold text-[#ffcf5a]">
                    {king.symbol.slice(0, 2)}
                  </div>
                )}
                <p className="max-w-xl text-sm leading-6 text-white/62">
                  The highest-conviction chart on JetForge right now. Follow the strongest volume surge before it graduates.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
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
  const [activeTab, setActiveTab] = useState<SortTab>("new");
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
    <div className="space-y-5">
      <div className="space-y-4 sm:hidden">
        <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(135deg,rgba(0,255,136,0.08),rgba(255,255,255,0.02)_42%,rgba(0,204,255,0.06))] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#86ffc4]">
            Live Market
          </div>
          <div className="mt-1.5 text-[1.85rem] font-extrabold leading-[0.98] tracking-tight text-white">
            Trade what&apos;s moving
          </div>
          <div className="mt-1.5 text-[13px] leading-5 text-white/58">
            Scan activity, check the leader, and jump into the market fast.
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              href="#market"
              className="flex-1 rounded-[16px] border border-white/12 bg-white/[0.04] px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              View Market
            </Link>
            <Link
              href="/launch"
              className="flex-1 rounded-[16px] bg-[linear-gradient(90deg,#00ff88,#00e5ff)] px-4 py-2.5 text-center text-sm font-extrabold text-[#03110d]"
            >
              Launch
            </Link>
          </div>
        </div>

        <StatsBar />
        <KingOfTheHill />
      </div>

      <div className="hidden gap-4 sm:grid xl:grid-cols-[minmax(0,1fr)_288px] xl:gap-5">
        <div className="min-w-0 space-y-6">
          <section className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(0,255,136,0.12),rgba(255,255,255,0.03)_35%,rgba(0,204,255,0.12))] px-4 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:rounded-[32px] sm:px-8 sm:py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(0,255,136,0.14),transparent_24%)]" />
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)", backgroundSize: "42px 42px" }} />
            <div className="relative grid gap-5 lg:grid-cols-[1.45fr_0.9fr] lg:items-end">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00ff88]/20 bg-[#00ff88]/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#86ffc4] sm:mb-4 sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.28em]">
                  <span className="live-dot" />
                  Fair-launch momentum on Solana
                </div>
                <h1 className="max-w-2xl text-[2.1rem] font-extrabold leading-none tracking-[-0.04em] text-white sm:text-5xl lg:text-[4.2rem]">
                  The Fairest Token Launch on Solana
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:mt-4 sm:text-lg sm:leading-7">
                  Launch fast, trade instantly, and ride the bonding curve before everyone else. No presales, no insider allocations, just transparent price discovery and pure FOMO.
                </p>
                <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">
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

              <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-1">
                {[
                  ["Zero presales", "Pure public discovery from the first trade"],
                  ["Real-time rotation", "Fresh trending charts every few seconds"],
                  ["Auto graduation", "Liquidity progresses toward DEX migration"],
                ].map(([title, desc], index) => (
                  <div
                    key={title}
                    className={clsx("glass-panel rounded-[24px] p-4 text-sm text-white/65", index === 0 && "animate-float")}
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
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-24">
            <LiveFeed />
          </div>
        </div>
      </div>

      <section id="market" className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
              Live Discovery
            </div>
            <h2 className="mt-2 max-w-[240px] text-[2rem] font-extrabold leading-[1.02] tracking-tight text-white sm:max-w-none sm:text-3xl">
              Find the next chart before it breaks out
            </h2>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
            <div className="relative min-w-0 xl:w-[260px] xl:flex-none">
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

            <div className="flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-sm scrollbar-none xl:w-fit">
              {TAB_CONFIG.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    "relative min-w-fit shrink-0 rounded-[14px] px-3 py-2.5 text-center text-sm font-semibold whitespace-nowrap transition-all sm:flex-none sm:px-4",
                    activeTab === tab.key
                      ? "bg-white/[0.08] text-white shadow-[inset_0_-2px_0_0_#00ff88,0_8px_20px_rgba(0,255,136,0.08)]"
                      : "text-white/45 hover:text-white/75"
                  )}
                >
                  {tab.key === "watchlist"
                    ? `Watchlist${watchlist.length > 0 ? ` (${watchlist.length})` : ""}`
                    : tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : tokens.length === 0 ? (
          <div className="glass-panel flex min-h-[260px] flex-col items-center justify-center rounded-[28px] px-6 py-16 text-center text-white/40">
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
                "grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
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
                <span className="text-sm text-white/45">{page} / {pagination.pages}</span>
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
  );
}
