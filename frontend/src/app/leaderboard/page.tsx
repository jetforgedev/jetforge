"use client";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  getTopTokens,
  getTopTraders,
  TraderData,
  truncateAddress,
  timeAgo,
  resolveImageUrl,
} from "@/lib/api";
import { useSolPrice, solToUsd } from "@/hooks/useSolPrice";

type TokenTab = "volume" | "marketcap" | "trades" | "new";
type TraderTab = "volume" | "trades";

function TokenRankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-[#FFD700] font-bold text-sm">🥇</span>;
  if (rank === 2) return <span className="text-[#C0C0C0] font-bold text-sm">🥈</span>;
  if (rank === 3) return <span className="text-[#CD7F32] font-bold text-sm">🥉</span>;
  return <span className="text-[#555] text-sm font-mono w-6 text-center">{rank}</span>;
}

function PnlBadge({ value }: { value: string }) {
  const num = parseFloat(value);
  const positive = num >= 0;
  return (
    <span className={`text-xs font-mono font-semibold whitespace-nowrap ${positive ? "text-[#00ff88]" : "text-[#ff4444]"}`}>
      {fmtPnl(value)} SOL
    </span>
  );
}

function GradProgress({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden flex-shrink-0">
        <div
          className="h-full bg-[#00ff88] rounded-full transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-[#555] text-[10px] font-mono whitespace-nowrap">{clamped.toFixed(0)}%</span>
    </div>
  );
}

function fmtVol(sol: number): string {
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(1)}M`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K`;
  return sol.toFixed(1);
}

function fmtPnl(pnl: string): string {
  const n = parseFloat(pnl);
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "−";
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(2)}`;
}

export default function LeaderboardPage() {
  const [tokenTab, setTokenTab] = useState<TokenTab>("volume");
  const [traderTab, setTraderTab] = useState<TraderTab>("volume");
  const solPrice = useSolPrice();

  const { data: tokens, isLoading: loadingTokens } = useQuery({
    queryKey: ["leaderboard-tokens", tokenTab],
    queryFn: () => getTopTokens(tokenTab, 20),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: traders, isLoading: loadingTraders } = useQuery({
    queryKey: ["leaderboard-traders", traderTab],
    queryFn: () => getTopTraders(traderTab, 20),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const tokenTabs: { key: TokenTab; label: string }[] = [
    { key: "volume", label: "Volume" },
    { key: "marketcap", label: "Market Cap" },
    { key: "trades", label: "Trades" },
    { key: "new", label: "Newest" },
  ];

  const traderTabs: { key: TraderTab; label: string }[] = [
    { key: "volume", label: "By Volume" },
    { key: "trades", label: "By Trades" },
  ];

  return (
    <div className="max-w-[1200px] mx-auto py-10 space-y-10 px-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Leaderboard</h1>
        <p className="text-[#555] text-sm">Top tokens and traders on JetForge</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Top Tokens */}
        <div>
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div className="text-white font-semibold text-sm">Top Tokens</div>
            <div className="flex gap-1 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-1 overflow-x-auto max-w-full">
              {tokenTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTokenTab(t.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    tokenTab === t.key
                      ? "bg-[#00ff88] text-black"
                      : "text-[#555] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl">
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden min-w-[420px]">
              {/* Table header */}
              <div className="grid grid-cols-[28px_1fr_72px_72px_90px] gap-2 px-4 py-2.5 border-b border-[#1a1a1a] text-[#444] text-xs uppercase tracking-wider">
                <div>#</div>
                <div>Token</div>
                <div className="text-right">MCap</div>
                <div className="text-right">Vol 24h</div>
                <div className="text-right">Progress</div>
              </div>

              {loadingTokens ? (
                <div className="space-y-0">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[28px_1fr_72px_72px_90px] gap-2 px-4 py-3 border-b border-[#111] last:border-0 animate-pulse">
                      <div className="w-5 h-4 bg-[#1a1a1a] rounded" />
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg" />
                        <div className="space-y-1">
                          <div className="w-20 h-3 bg-[#1a1a1a] rounded" />
                          <div className="w-12 h-2 bg-[#111] rounded" />
                        </div>
                      </div>
                      <div className="w-16 h-3 bg-[#1a1a1a] rounded ml-auto" />
                      <div className="w-16 h-3 bg-[#1a1a1a] rounded ml-auto" />
                      <div className="w-16 h-3 bg-[#1a1a1a] rounded ml-auto" />
                    </div>
                  ))}
                </div>
              ) : !tokens || tokens.length === 0 ? (
                <div className="py-16 text-center text-[#444] text-sm">No tokens yet</div>
              ) : (
                <div>
                  {tokens.map((token) => (
                    <Link
                      key={token.mint}
                      href={`/token/${token.mint}`}
                      className="grid grid-cols-[28px_1fr_72px_72px_90px] gap-2 px-4 py-3 border-b border-[#111] last:border-0 hover:bg-[#111] transition-colors items-center"
                    >
                      <div className="flex items-center justify-center">
                        <TokenRankBadge rank={(token as any).rank ?? 0} />
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        {resolveImageUrl(token.imageUrl) ? (
                          <img
                            src={resolveImageUrl(token.imageUrl)!}
                            alt={token.symbol}
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-xs text-[#555] flex-shrink-0">
                            {token.symbol?.[0] ?? "?"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-white text-xs font-semibold truncate">{token.name}</div>
                          <div className="flex items-center gap-1">
                            <span className="text-[#555] text-[10px]">${token.symbol}</span>
                            {token.isGraduated && (
                              <span className="px-1 py-0 bg-[#00ff8820] border border-[#00ff8840] rounded text-[#00ff88] text-[9px] font-semibold leading-4">
                                GRAD
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-white text-xs">{fmtVol(Number(token.marketCapSol))}</span>
                        <span className="text-[#555] text-[10px] ml-0.5">SOL</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-[#888] text-xs">{fmtVol(Number(token.volume24h))}</span>
                        <span className="text-[#555] text-[10px] ml-0.5">SOL</span>
                      </div>
                      <div className="flex justify-end">
                        <GradProgress pct={token.graduationProgress ?? 0} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Traders */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-white font-semibold text-sm">Top Traders</div>
            <div className="flex gap-1 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-1">
              {traderTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTraderTab(t.key)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    traderTab === t.key
                      ? "bg-[#00ff88] text-black"
                      : "text-[#555] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl">
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden min-w-[380px]">
              {/* Table header */}
              <div className="grid grid-cols-[32px_1fr_80px_70px_80px] gap-2 px-4 py-2.5 border-b border-[#1a1a1a] text-[#444] text-xs uppercase tracking-wider">
                <div>#</div>
                <div>Wallet</div>
                <div className="text-right">Volume</div>
                <div className="text-right">Trades</div>
                <div className="text-right">Realized PnL</div>
              </div>

              {loadingTraders ? (
                <div className="space-y-0">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[32px_1fr_80px_70px_80px] gap-2 px-4 py-3 border-b border-[#111] last:border-0 animate-pulse">
                      <div className="w-5 h-4 bg-[#1a1a1a] rounded" />
                      <div className="w-28 h-3 bg-[#1a1a1a] rounded" />
                      <div className="w-16 h-3 bg-[#1a1a1a] rounded ml-auto" />
                      <div className="w-10 h-3 bg-[#1a1a1a] rounded ml-auto" />
                      <div className="w-16 h-3 bg-[#1a1a1a] rounded ml-auto" />
                    </div>
                  ))}
                </div>
              ) : !traders || traders.length === 0 ? (
                <div className="py-16 text-center text-[#444] text-sm">No traders yet</div>
              ) : (
                <div>
                  {traders.map((trader) => (
                    <Link
                      key={trader.wallet}
                      href={`/portfolio/${trader.wallet}`}
                      className="grid grid-cols-[32px_1fr_80px_70px_80px] gap-2 px-4 py-3 border-b border-[#111] last:border-0 hover:bg-[#111] transition-colors items-center"
                    >
                      <div className="flex items-center justify-center">
                        <TokenRankBadge rank={trader.rank} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-white text-xs font-mono truncate">
                          {truncateAddress(trader.wallet, 6)}
                        </div>
                        <div className="text-[#444] text-[10px]">{trader.totalTrades} trades</div>
                      </div>
                      <div className="text-right">
                        <div>
                          <span className="text-[#888] text-xs">{trader.totalVolumeSol}</span>
                          <span className="text-[#555] text-[10px] ml-0.5">SOL</span>
                        </div>
                        {solToUsd(parseFloat(trader.totalVolumeSol), solPrice) && (
                          <div className="text-[#444] text-[10px]">{solToUsd(parseFloat(trader.totalVolumeSol), solPrice)}</div>
                        )}
                      </div>
                      <div className="text-right text-[#666] text-xs">
                        {trader.totalTrades}
                      </div>
                      <div className="text-right">
                        <PnlBadge value={trader.realizedPnlSol} />
                        {solToUsd(parseFloat(trader.realizedPnlSol ?? "0"), solPrice) && (
                          <div className="text-[#444] text-[10px]">{solToUsd(parseFloat(trader.realizedPnlSol ?? "0"), solPrice)}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Tokens", value: tokens?.length ?? "—", sub: "on JetForge" },
          {
            label: "Graduated",
            value: tokens?.filter((t) => t.isGraduated).length ?? "—",
            sub: "to DEX",
          },
          { label: "Top Traders", value: traders?.length ?? "—", sub: "ranked" },
          {
            label: "Total Volume",
            value: traders
              ? traders.reduce((acc, t) => acc + parseFloat(t.totalVolumeSol), 0).toFixed(1) + " SOL"
              : "—",
            sub: (() => {
              if (!traders) return "all time";
              const vol = traders.reduce((acc, t) => acc + parseFloat(t.totalVolumeSol), 0);
              return solToUsd(vol, solPrice) ?? "all time";
            })(),
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
            <div className="text-[#555] text-xs mb-1">{stat.label}</div>
            <div className="text-white font-bold text-lg">{stat.value}</div>
            <div className="text-[#333] text-xs">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
