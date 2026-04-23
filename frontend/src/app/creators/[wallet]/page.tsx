"use client";
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { getCreatorProfile, truncateAddress, timeAgo, resolveImageUrl, getFollowStats, followCreator, unfollowCreator } from "@/lib/api";
import { useSolPrice, solToUsd } from "@/hooks/useSolPrice";

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
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const viewer = publicKey?.toBase58();
  const isOwn = viewer === wallet;

  const solPrice = useSolPrice();

  const { data: creator, isLoading, error } = useQuery({
    queryKey: ["creator-profile", wallet],
    queryFn: () => getCreatorProfile(wallet),
    staleTime: 30_000,
    retry: false,
  });

  const { data: followStats } = useQuery({
    queryKey: ["follow-stats", wallet, viewer],
    queryFn: () => getFollowStats(wallet, viewer),
    staleTime: 30_000,
  });

  const toggleFollow = async () => {
    if (!viewer) return;
    try {
      if (followStats?.isFollowing) {
        await unfollowCreator(viewer, wallet);
      } else {
        await followCreator(viewer, wallet);
      }
      queryClient.invalidateQueries({ queryKey: ["follow-stats", wallet] });
    } catch {}
  };

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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Follower stats */}
            <div className="flex items-center gap-3 text-xs text-[#555] border border-[#1a1a1a] px-3 py-1.5 rounded-lg">
              <span><span className="text-white font-semibold">{followStats?.followerCount ?? 0}</span> followers</span>
              <span className="text-[#2a2a2a]">·</span>
              <span><span className="text-white font-semibold">{followStats?.followingCount ?? 0}</span> following</span>
            </div>
            {!isOwn && (
              <button
                onClick={toggleFollow}
                disabled={!viewer}
                title={!viewer ? "Connect wallet to follow" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                  !viewer
                    ? "border-[#2a2a2a] text-[#444] cursor-not-allowed bg-transparent"
                    : followStats?.isFollowing
                      ? "bg-[#00ff8815] border-[#00ff8840] text-[#00ff88] hover:bg-[#00ff8825]"
                      : "bg-[#00ff88] border-[#00ff88] text-black font-bold hover:bg-[#00dd77]"
                }`}
              >
                {!viewer ? "Connect to Follow" : followStats?.isFollowing ? "✓ Following" : "+ Follow"}
              </button>
            )}
            <Link
              href={`/portfolio/${wallet}`}
              className="text-xs text-[#555] hover:text-white border border-[#2a2a2a] px-3 py-1.5 rounded-md transition-colors"
            >
              Portfolio →
            </Link>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
          {[
            { label: "Tokens Launched", value: creator.tokensLaunched, accent: false, usd: null },
            { label: "Graduated", value: creator.graduatedTokens, accent: creator.graduatedTokens > 0, usd: null },
            {
              label: "Total Volume",
              value: `${parseFloat(creator.totalVolumeSol).toFixed(2)} SOL`,
              accent: false,
              usd: solToUsd(parseFloat(creator.totalVolumeSol), solPrice),
            },
          ].map((s) => (
            <div key={s.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
              <div className="text-[#555] text-xs mb-1">{s.label}</div>
              <div className={`font-mono font-semibold text-sm ${s.accent ? "text-[#00ff88]" : "text-white"}`}>
                {s.value}
              </div>
              {s.usd && <div className="text-[#444] text-[10px] mt-0.5">{s.usd}</div>}
            </div>
          ))}
        </div>

        {/* Earnings row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="bg-[#0d0d0d] border border-[#00ff8830] rounded-lg p-4">
            <div className="text-[#555] text-xs mb-1">💰 All-Time Earnings</div>
            <div className="text-[#00ff88] font-mono font-bold text-xl">
              {parseFloat(creator.estimatedEarningsSol).toFixed(4)} SOL
            </div>
            {solToUsd(parseFloat(creator.estimatedEarningsSol), solPrice) && (
              <div className="text-[#00ff8880] text-xs mt-0.5">{solToUsd(parseFloat(creator.estimatedEarningsSol), solPrice)}</div>
            )}
            <div className="text-[#444] text-[10px] mt-1">
              0.4% of all trading volume on your tokens · cumulative total
            </div>
          </div>
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
            <div className="text-[#555] text-xs mb-1">🏦 Claimable Now</div>
            <div className="text-white font-mono font-bold text-xl">
              {parseFloat(creator.claimableEarningsSol ?? "0").toFixed(4)} SOL
            </div>
            {solToUsd(parseFloat(creator.claimableEarningsSol ?? "0"), solPrice) && (
              <div className="text-[#88888880] text-xs mt-0.5">{solToUsd(parseFloat(creator.claimableEarningsSol ?? "0"), solPrice)}</div>
            )}
            <div className="text-[#444] text-[10px] mt-1">
              Sitting in your on-chain vaults · withdraw from each token page
            </div>
          </div>
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
          <>
            {/* ── Mobile card list ── */}
            <div className="sm:hidden space-y-2">
              {creator.tokens.map((token: any) => (
                <Link
                  key={token.mint}
                  href={`/token/${token.mint}`}
                  className="flex items-center gap-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-3 hover:border-[#2a2a2a] transition-colors"
                >
                  {/* Image */}
                  {resolveImageUrl(token.imageUrl) ? (
                    <img src={resolveImageUrl(token.imageUrl)!} alt={token.symbol} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-sm font-bold text-[#555] flex-shrink-0">
                      {token.symbol?.[0] ?? "?"}
                    </div>
                  )}
                  {/* Name + time */}
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-sm font-semibold truncate">{token.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[#555] text-[10px] font-mono">${token.symbol}</span>
                      <span className="text-[#333] text-[10px]">·</span>
                      <span className="text-[#555] text-[10px]">{timeAgo(token.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[#666] text-[10px]">
                        {parseFloat(token.realSolReserves).toFixed(2)} SOL raised
                        {solToUsd(parseFloat(token.realSolReserves), solPrice) && (
                          <span className="text-[#444] ml-1">({solToUsd(parseFloat(token.realSolReserves), solPrice)})</span>
                        )}
                      </span>
                      <span className="text-[#333] text-[10px]">·</span>
                      <span className="text-[#666] text-[10px]">{token.trades} trades</span>
                    </div>
                  </div>
                  {/* Right: status + claimable */}
                  <div className="flex-shrink-0 text-right">
                    {token.isGraduated ? (
                      <span className="px-1.5 py-0.5 bg-[#00ff8820] border border-[#00ff8840] rounded text-[#00ff88] text-[10px] font-semibold">GRAD</span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#555] text-[10px]">LIVE</span>
                    )}
                    {parseFloat(token.claimableEarnings) > 0 && (
                      <div className="text-[#00ff88] text-[10px] font-mono mt-1">
                        {parseFloat(token.claimableEarnings).toFixed(3)} SOL
                      </div>
                    )}
                    {parseFloat(token.claimableEarnings) > 0 && solToUsd(parseFloat(token.claimableEarnings), solPrice) && (
                      <div className="text-[#444] text-[10px]">{solToUsd(parseFloat(token.claimableEarnings), solPrice)}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden sm:block overflow-x-auto rounded-xl">
              <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden min-w-[400px]">
                <div className="grid grid-cols-[1fr_80px_60px_80px_55px] gap-2 px-4 py-2.5 border-b border-[#1a1a1a] text-[#444] text-xs uppercase tracking-wider">
                  <div>Token</div>
                  <div className="text-right">Raised</div>
                  <div className="text-right">Trades</div>
                  <div className="text-right">Claimable</div>
                  <div className="text-right">Status</div>
                </div>
                {creator.tokens.map((token: any) => (
                  <Link
                    key={token.mint}
                    href={`/token/${token.mint}`}
                    className="grid grid-cols-[1fr_80px_60px_80px_55px] gap-2 px-4 py-3 border-b border-[#111] last:border-0 hover:bg-[#111] transition-colors items-center"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {resolveImageUrl(token.imageUrl) ? (
                        <img src={resolveImageUrl(token.imageUrl)!} alt={token.symbol} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
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
                      <div>
                        <span className="text-[#888] text-xs">{parseFloat(token.realSolReserves).toFixed(2)}</span>
                        <span className="text-[#555] text-[10px] ml-0.5">SOL</span>
                      </div>
                      {solToUsd(parseFloat(token.realSolReserves), solPrice) && (
                        <div className="text-[#444] text-[10px]">{solToUsd(parseFloat(token.realSolReserves), solPrice)}</div>
                      )}
                    </div>
                    <div className="text-right text-[#666] text-xs">{token.trades}</div>
                    <div className="text-right">
                      {parseFloat(token.claimableEarnings) > 0 ? (
                        <>
                          <div className="text-[#00ff88] text-xs font-mono">{parseFloat(token.claimableEarnings).toFixed(4)}</div>
                          {solToUsd(parseFloat(token.claimableEarnings), solPrice) && (
                            <div className="text-[#444] text-[10px]">{solToUsd(parseFloat(token.claimableEarnings), solPrice)}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-[#333] text-xs">—</span>
                      )}
                    </div>
                    <div className="flex justify-end">
                      {token.isGraduated ? (
                        <span className="px-1.5 py-0.5 bg-[#00ff8820] border border-[#00ff8840] rounded text-[#00ff88] text-[10px]">GRAD</span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#555] text-[10px]">LIVE</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
