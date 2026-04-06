"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TokenCard } from "@/components/TokenCard";
import { LiveFeed } from "@/components/LiveFeed";
import { getTokens, TokenData } from "@/lib/api";
import { clsx } from "clsx";

type SortTab = "trending" | "new" | "graduating";

const TAB_CONFIG = [
  { key: "trending" as SortTab, label: "🔥 Trending" },
  { key: "new" as SortTab, label: "🆕 New" },
  { key: "graduating" as SortTab, label: "🎓 Graduating" },
];

function StatsBar() {
  const { data: trending } = useQuery({
    queryKey: ["tokens", "trending", 1],
    queryFn: () => getTokens("trending", 1, 1),
    staleTime: 30_000,
  });

  const stats = [
    { label: "Total Tokens", value: trending?.pagination.total?.toLocaleString() ?? "—" },
    { label: "24h Volume", value: "—" },
    { label: "Live Trades", value: "🟢 Active" },
  ];

  return (
    <div className="flex items-center gap-6 text-xs text-[#555] overflow-x-auto pb-2 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-2 shrink-0">
          <span>{s.label}:</span>
          <span className="text-white font-mono font-medium">{s.value}</span>
        </div>
      ))}
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

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<SortTab>("new");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["tokens", activeTab, page],
    queryFn: () => getTokens(activeTab, page),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Reset to page 1 on tab change
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const tokens = data?.tokens ?? [];
  const pagination = data?.pagination;

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <StatsBar />

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[#111] border border-[#1a1a1a] rounded-xl p-1 w-fit">
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
              {tab.label}
            </button>
          ))}
        </div>

        {/* Token grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#333]">
            <div className="text-5xl mb-4">🚀</div>
            <div className="text-lg font-semibold text-[#555]">No tokens yet</div>
            <div className="text-sm mt-1">
              Be the first to{" "}
              <a href="/launch" className="text-[#00ff88] hover:underline">
                launch a token
              </a>
            </div>
          </div>
        ) : (
          <>
            <div
              className={clsx(
                "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
                isFetching && "opacity-80 transition-opacity"
              )}
            >
              {tokens.map((token: TokenData) => (
                <TokenCard key={token.mint} token={token} />
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
                <span className="text-[#555] text-sm">
                  {page} / {pagination.pages}
                </span>
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

      {/* Live Feed sidebar */}
      <div className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-20">
          <LiveFeed />
        </div>
      </div>
    </div>
  );
}
