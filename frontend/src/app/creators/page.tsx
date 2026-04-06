"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCreators, CreatorData, truncateAddress } from "@/lib/api";

type Metric = "volume" | "tokens";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-[#FFD700] text-sm">🥇</span>;
  if (rank === 2) return <span className="text-[#C0C0C0] text-sm">🥈</span>;
  if (rank === 3) return <span className="text-[#CD7F32] text-sm">🥉</span>;
  return <span className="text-[#555] text-sm font-mono w-6 text-center">{rank}</span>;
}

function ReputationBadge({ badge, label, color }: { badge: string; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ borderColor: color + "40", backgroundColor: color + "15", color }}
    >
      {badge} {label}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
      <div className="text-[#555] text-xs mb-1">{label}</div>
      <div className="text-white font-bold text-lg">{value}</div>
      {sub && <div className="text-[#333] text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export default function CreatorsPage() {
  const [metric, setMetric] = useState<Metric>("volume");

  const { data: creators, isLoading } = useQuery({
    queryKey: ["creators", metric],
    queryFn: () => getCreators(metric, 30),
    refetchInterval: 30_000,
  });

  const tabs: { key: Metric; label: string }[] = [
    { key: "volume", label: "By Volume" },
    { key: "tokens", label: "By Tokens" },
  ];

  const totalTokens = creators?.reduce((a, c) => a + c.tokensLaunched, 0) ?? 0;
  const totalGraduated = creators?.reduce((a, c) => a + c.graduatedTokens, 0) ?? 0;
  const totalVol = creators?.reduce((a, c) => a + parseFloat(c.totalVolumeSol), 0) ?? 0;
  const totalEarnings = creators?.reduce((a, c) => a + parseFloat(c.estimatedEarningsSol), 0) ?? 0;

  return (
    <div className="max-w-[1200px] mx-auto py-10 space-y-8 px-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Creator Hub</h1>
        <p className="text-[#555] text-sm">
          Top token creators on JetForge — reputation, earnings, and performance
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Tokens Launched" value={totalTokens} sub="by all creators" />
        <StatCard label="Graduated" value={totalGraduated} sub="to DEX" />
        <StatCard label="Total Volume" value={`${totalVol.toFixed(1)} SOL`} sub="all time" />
        <StatCard label="Creator Earnings" value={`${totalEarnings.toFixed(3)} SOL`} sub="estimated fees" />
      </div>

      {/* Leaderboard table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-white font-semibold text-sm">Creator Leaderboard</div>
          <div className="flex gap-1 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setMetric(t.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  metric === t.key
                    ? "bg-[#00ff88] text-black"
                    : "text-[#555] hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[32px_1fr_90px_70px_70px_90px_100px] gap-2 px-4 py-2.5 border-b border-[#1a1a1a] text-[#444] text-xs uppercase tracking-wider">
            <div>#</div>
            <div>Creator</div>
            <div className="text-right">Reputation</div>
            <div className="text-right">Tokens</div>
            <div className="text-right">Grad</div>
            <div className="text-right">Volume</div>
            <div className="text-right">Est. Earnings</div>
          </div>

          {isLoading ? (
            <div>
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[32px_1fr_90px_70px_70px_90px_100px] gap-2 px-4 py-3 border-b border-[#111] last:border-0 animate-pulse"
                >
                  <div className="w-5 h-4 bg-[#1a1a1a] rounded" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#1a1a1a]" />
                    <div className="w-28 h-3 bg-[#1a1a1a] rounded" />
                  </div>
                  <div className="w-16 h-4 bg-[#1a1a1a] rounded ml-auto" />
                  <div className="w-8 h-3 bg-[#1a1a1a] rounded ml-auto" />
                  <div className="w-8 h-3 bg-[#1a1a1a] rounded ml-auto" />
                  <div className="w-16 h-3 bg-[#1a1a1a] rounded ml-auto" />
                  <div className="w-16 h-3 bg-[#1a1a1a] rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : !creators || creators.length === 0 ? (
            <div className="py-16 text-center text-[#444] text-sm">No creators yet — be the first to launch!</div>
          ) : (
            <div>
              {creators.map((creator) => (
                <Link
                  key={creator.wallet}
                  href={`/creators/${creator.wallet}`}
                  className="grid grid-cols-[32px_1fr_90px_70px_70px_90px_100px] gap-2 px-4 py-3 border-b border-[#111] last:border-0 hover:bg-[#111] transition-colors items-center"
                >
                  <div className="flex items-center justify-center">
                    <RankBadge rank={creator.rank} />
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    {creator.latestToken?.imageUrl ? (
                      <img
                        src={creator.latestToken.imageUrl}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-xs text-[#555] flex-shrink-0">
                        {creator.wallet.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-white text-xs font-mono truncate">
                        {truncateAddress(creator.wallet, 6)}
                      </div>
                      {creator.latestToken && (
                        <div className="text-[#444] text-[10px] truncate">
                          Latest: {creator.latestToken.symbol}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <ReputationBadge
                      badge={creator.badge}
                      label={creator.badgeLabel}
                      color={creator.badgeColor}
                    />
                  </div>

                  <div className="text-right text-white text-xs font-mono">
                    {creator.tokensLaunched}
                  </div>

                  <div className="text-right">
                    <span className={`text-xs font-mono ${creator.graduatedTokens > 0 ? "text-[#00ff88]" : "text-[#555]"}`}>
                      {creator.graduatedTokens}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[#888] text-xs">{parseFloat(creator.totalVolumeSol).toFixed(2)}</span>
                    <span className="text-[#555] text-[10px] ml-0.5">SOL</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[#00ff88] text-xs font-mono">
                      {parseFloat(creator.estimatedEarningsSol).toFixed(4)}
                    </span>
                    <span className="text-[#555] text-[10px] ml-0.5">SOL</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Badge legend */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-5">
        <div className="text-white text-sm font-semibold mb-4">Reputation Badges</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { badge: "🚀", label: "Rocket Creator", color: "#00ff88", desc: "3+ graduated or 500+ SOL volume" },
            { badge: "⭐", label: "Rising Star", color: "#FFD700", desc: "1+ graduated or 100+ SOL volume" },
            { badge: "🔥", label: "Hot Creator", color: "#ff6b35", desc: "5+ tokens or 20+ SOL volume" },
            { badge: "💎", label: "Builder", color: "#7b68ee", desc: "2+ tokens or 5+ SOL volume" },
            { badge: "🌱", label: "Newcomer", color: "#888", desc: "Just getting started" },
          ].map((b) => (
            <div key={b.label} className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
              <ReputationBadge badge={b.badge} label={b.label} color={b.color} />
              <p className="text-[#444] text-[10px] mt-2 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
