"use client";
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getCreatorProfile, truncateAddress, timeAgo } from "@/lib/api";

interface PageProps {
  params: Promise<{ wallet: string }>;
}

function ReputationBadge({ badge, label, color }: { badge: string; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
      style={{ borderColor: color + "40", backgroundColor: color + "15", color }}
    >
      {badge} {label}
    </span>
  );
}

export default function CreatorProfilePage({ params }: PageProps) {
  const { wallet } = React.use(params);

  const { data: creator, isLoading, error } = useQuery({
    queryKey: ["creator-profile", wallet],
    queryFn: () => getCreatorProfile(wallet),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="max-w-[900px] mx-auto py-10 px-4 space-y-4 animate-pulse">
        <div className="h-32 bg-[#111] rounded-xl" />
        <div className="h-48 bg-[#111] rounded-xl" />
      </div>
    );
  }

  if (error || !creator) return notFound();

  return (
    <div className="max-w-[900px] mx-auto py-10 px-4 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#555]">
        <Link href="/creators" className="hover:text-[#888] transition-colors">Creators</Link>
        <span>/</span>
        <span className="text-[#888]">{truncateAddress(wallet, 6)}</span>
      </div>

      {/* Creator header card */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00ff8830] to-[#00ff8810] border border-[#00ff8830] flex items-center justify-center text-2xl">
              {creator.badge}
            </div>
            <div>
              <div className="text-white font-bold text-lg font-mono">{truncateAddress(wallet, 8)}</div>
              <div className="mt-1.5">
                <ReputationBadge badge={creator.badge} label={creator.badgeLabel} color={creator.badgeColor} />
              </div>
            </div>
          </div>

          <Link
            href={`/portfolio/${wallet}`}
            className="text-xs text-[#555] hover:text-white border border-[#2a2a2a] px-3 py-1.5 rounded-md transition-colors"
          >
            View Portfolio →
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { label: "Tokens Launched", value: creator.tokensLaunched, accent: false },
            { label: "Graduated", value: creator.graduatedTokens, accent: creator.graduatedTokens > 0 },
            { label: "Total Volume", value: `${parseFloat(creator.totalVolumeSol).toFixed(2)} SOL`, accent: false },
            { label: "Est. Earnings", value: `${parseFloat(creator.estimatedEarningsSol).toFixed(4)} SOL`, accent: true },
          ].map((s) => (
            <div key={s.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
              <div className="text-[#555] text-xs mb-1">{s.label}</div>
              <div className={`font-mono font-semibold text-sm ${s.accent ? "text-[#00ff88]" : "text-white"}`}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tokens launched */}
      <div>
        <div className="text-white font-semibold text-sm mb-3">Tokens Launched</div>
        {creator.tokens.length === 0 ? (
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-8 text-center text-[#444] text-sm">
            No tokens launched yet
          </div>
        ) : (
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px_60px_60px] gap-2 px-4 py-2.5 border-b border-[#1a1a1a] text-[#444] text-xs uppercase tracking-wider">
              <div>Token</div>
              <div className="text-right">Volume</div>
              <div className="text-right">Raised</div>
              <div className="text-right">Trades</div>
              <div className="text-right">Status</div>
            </div>
            {creator.tokens.map((token: any) => (
              <Link
                key={token.mint}
                href={`/token/${token.mint}`}
                className="grid grid-cols-[1fr_80px_80px_60px_60px] gap-2 px-4 py-3 border-b border-[#111] last:border-0 hover:bg-[#111] transition-colors items-center"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {token.imageUrl ? (
                    <img src={token.imageUrl} alt={token.symbol} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-xs text-[#555] flex-shrink-0">
                      {token.symbol?.[0] ?? "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-white text-xs font-semibold truncate">{token.name}</div>
                    <div className="text-[#555] text-[10px]">{timeAgo(token.createdAt)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[#888] text-xs">{parseFloat(token.volume24h).toFixed(2)}</span>
                  <span className="text-[#555] text-[10px] ml-0.5">SOL</span>
                </div>
                <div className="text-right">
                  <span className="text-[#888] text-xs">{parseFloat(token.realSolReserves).toFixed(2)}</span>
                  <span className="text-[#555] text-[10px] ml-0.5">SOL</span>
                </div>
                <div className="text-right text-[#666] text-xs">{token.trades}</div>
                <div className="flex justify-end">
                  {token.isGraduated ? (
                    <span className="px-1.5 py-0.5 bg-[#00ff8820] border border-[#00ff8840] rounded text-[#00ff88] text-[10px]">
                      GRAD
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#555] text-[10px]">
                      LIVE
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
