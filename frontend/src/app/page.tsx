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

  return (
    <div className="flex items-center gap-4 text-xs overflow-x-auto pb-2 mb-6 flex-wrap">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse-glow inline-block" />
        <span className="text-[#00ff88] font-semibold">LIVE</span>
      </div>
      <div className="w-px h-4 bg-[#2a2a2a] shrink-0" />
      <div className="flex items-center gap-1.5 shrink-0 text-[#555]">
        <span>Tokens:</span>
        <span className="text-white font-mono font-medium">{stats?.totalTokens?.toLocaleString() ?? "—"}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 text-[#555]">
        <span>24h Vol:</span>
        <span className="text-[#00ff88] font-mono font-semibold">{stats ? `${stats.volume24hSol.toLocaleString()} SOL` : "—"}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 text-[#555]">
        <span>24h Trades:</span>
        <span className="text-white font-mono font-medium">{stats?.trades24h?.toLocaleString() ?? "—"}</span>
      </div>
      {graduatingCount > 0 && (
        <>
          <div className="w-px h-4 bg-[#2a2a2a] shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0 animate-pulse">
            <span className="text-yellow-400 font-semibold">📈 {graduatingCount} graduating now</span>
          </div>
        </>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 animate-pulse">
      <div className="flex gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-[#1a1a1a]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#1a1a1a] rounded w-3/4" />
          <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-[#1a1a1a] rounded" />
        ))}
      </div>
      <div className="h-3 bg-[#1a1a1a] rounded" />
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
      <div className="relative mb-6 rounded-xl overflow-hidden border border-[#ffaa0030] bg-gradient-to-r from-[#ffaa0008] to-[#ff660008] hover:border-[#ffaa0060] transition-all cursor-pointer">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="text-2xl shrink-0">👑</div>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {king.imageUrl ? (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                <Image src={king.imageUrl} alt={king.name} fill className="object-cover" unoptimized />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[#ffaa0020] flex items-center justify-center text-[#ffaa00] font-bold text-sm shrink-0">
                {king.symbol.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[#ffaa00] font-bold text-sm">King of the Hill</span>
                <span className="text-[#555] text-xs">· rotates every hour</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white font-semibold text-sm">{king.name}</span>
                <span className="text-[#555] text-xs font-mono">${king.symbol}</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[#555] text-[10px]">24H VOLUME</div>
            <div className="text-white font-mono font-semibold text-sm">
              {king.volume24h.toFixed(2)} SOL
            </div>
          </div>
          <div className="shrink-0 text-right hidden sm:block">
            <div className="text-[#555] text-[10px]">MARKET CAP</div>
            <div className="text-[#ffaa00] font-mono font-semibold text-sm">
              {king.marketCapSol.toFixed(2)} SOL
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

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on tab/search change
  useEffect(() => { setPage(1); }, [activeTab, debouncedSearch]);

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
      // Fetch all pages and filter by watchlist mints
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
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <StatsBar />

        {/* King of the Hill */}
        <KingOfTheHill />

        {/* Search + Tabs row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-2 pl-9 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#333] transition-colors"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] text-sm">🔍</span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[#111] border border-[#1a1a1a] rounded-xl p-1 w-fit">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.key
                    ? "bg-[#1a1a1a] text-white shadow-sm"
                    : "text-[#555] hover:text-[#888]"
                )}
              >
                {tab.key === "watchlist"
                  ? `⭐ Watchlist${watchlist.length > 0 ? ` (${watchlist.length})` : ""}`
                  : tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Token grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#333]">
            {activeTab === "watchlist" ? (
              <>
                <div className="text-5xl mb-4">⭐</div>
                <div className="text-lg font-semibold text-[#555]">No tokens starred</div>
                <div className="text-sm mt-1 text-[#444]">Click ⭐ on any token card to save it here</div>
              </>
            ) : debouncedSearch ? (
              <>
                <div className="text-5xl mb-4">🔍</div>
                <div className="text-lg font-semibold text-[#555]">No results for "{debouncedSearch}"</div>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">🚀</div>
                <div className="text-lg font-semibold text-[#555]">No tokens yet</div>
                <div className="text-sm mt-1">
                  Be the first to{" "}
                  <a href="/launch" className="text-[#00ff88] hover:underline">launch a token</a>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className={clsx(
              "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
              isFetching && "opacity-80 transition-opacity"
            )}>
              {tokens.map((token: TokenData) => (
                <TokenCard
                  key={token.mint}
                  token={token}
                  isWatched={watchlist.includes(token.mint)}
                  onWatchToggle={() => toggle(token.mint)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm rounded-lg border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <span className="text-[#555] text-sm">{page} / {pagination.pages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                  className="px-4 py-2 text-sm rounded-lg border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Live Feed sidebar — desktop only */}
      <div className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-20">
          <LiveFeed />
        </div>
      </div>

      {/* Mobile FAB — Launch Token */}
      <Link href="/launch" className="fixed bottom-6 right-6 z-50 lg:hidden">
        <div className="flex items-center gap-2 bg-[#00ff88] text-black font-bold px-5 py-3 rounded-full shadow-lg shadow-[#00ff8840] text-sm active:scale-95 transition-transform">
          🚀 <span>Launch Token</span>
        </div>
      </Link>
    </div>
  );
}
