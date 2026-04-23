"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getUserTrades, getTokensByCreator, getFollowStats, getFollowers, getFollowing, getPortfolio, truncateAddress, timeAgo, resolveImageUrl } from "@/lib/api";

interface PageProps {
  params: Promise<{ wallet: string }>;
}

// Format very small prices intelligently
function fmtPrice(sol: number): string {
  if (sol === 0) return "0.000000";
  if (sol >= 0.000001) return sol.toFixed(6);
  if (sol >= 0.0000001) return sol.toFixed(9);
  // Scientific notation for extremely small values
  return sol.toExponential(3);
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
      <div className="text-[#555] text-xs mb-1">{label}</div>
      <div className={`font-mono font-semibold text-lg ${accent ? "text-[#00ff88]" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}


export default function PortfolioPage({ params }: PageProps) {
  const { wallet } = React.use(params);
  const [activeList, setActiveList] = React.useState<"followers" | "following" | null>(null);
  const { data: tradesData, isLoading: tradesLoading } = useQuery({
    queryKey: ["portfolio-trades", wallet],
    queryFn: () => getUserTrades(wallet),
  });

  const { data: portfolioData, isLoading: portfolioLoading } = useQuery({
    queryKey: ["portfolio", wallet],
    queryFn: () => getPortfolio(wallet),
  });

  const { data: tokensData, isLoading: tokensLoading } = useQuery({
    queryKey: ["portfolio-tokens", wallet],
    queryFn: () => getTokensByCreator(wallet),
  });

  const { data: followStats } = useQuery({
    queryKey: ["follow-stats", wallet],
    queryFn: () => getFollowStats(wallet),
    staleTime: 30_000,
  });

  const { data: followersData, isLoading: followersLoading } = useQuery({
    queryKey: ["followers-list", wallet],
    queryFn: () => getFollowers(wallet),
    enabled: activeList === "followers",
  });

  const { data: followingData, isLoading: followingLoading } = useQuery({
    queryKey: ["following-list", wallet],
    queryFn: () => getFollowing(wallet),
    enabled: activeList === "following",
  });

  const summary = tradesData?.summary;
  const trades = tradesData?.trades ?? [];
  const createdTokens = tokensData?.tokens ?? [];
  const holdings = portfolioData?.holdings ?? [];
  const realizedPnlSol = portfolioData?.realizedPnlSol ?? 0;

  const activeHoldings = holdings.filter((h) => h.tokenBalance > 0.001);

  const totalTrades = (parseInt(summary?.totalBuys ?? "0") + parseInt(summary?.totalSells ?? "0"));
  const hasWhaleTrade = trades.some((t: any) => Number(t.solAmount) / 1e9 >= 1);
  const hasProfitableTrade = holdings.some((h) => h.realizedPnlSol > 0);

  const badges: { icon: string; label: string; description: string; color: string }[] = [];
  if (totalTrades >= 1) badges.push({ icon: "🌟", label: "Rising Star", description: "Made first trade", color: "#f59e0b" });
  if (totalTrades >= 10) badges.push({ icon: "⚡", label: "Active Trader", description: "10+ trades completed", color: "#60a5fa" });
  if (totalTrades >= 50) badges.push({ icon: "🔥", label: "Grinder", description: "50+ trades completed", color: "#f97316" });
  if (totalTrades >= 100) badges.push({ icon: "🎰", label: "Degen", description: "100+ trades completed", color: "#a78bfa" });
  if (hasWhaleTrade) badges.push({ icon: "🐋", label: "Whale", description: "Single trade ≥ 1 SOL", color: "#38bdf8" });
  if (hasProfitableTrade) badges.push({ icon: "💎", label: "Diamond Hands", description: "Closed a profitable position", color: "#67e8f9" });
  if (createdTokens.length >= 1) badges.push({ icon: "🚀", label: "Creator", description: "Launched at least 1 token", color: "#00ff88" });
  if (createdTokens.some((t: any) => t.isGraduated)) badges.push({ icon: "🎓", label: "Graduated", description: "A created token graduated", color: "#c084fc" });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/" className="text-[#555] hover:text-[#888] text-xs transition-colors">Home</Link>
        <span className="text-[#333]">/</span>
        <span className="text-[#888] text-xs font-mono">{truncateAddress(wallet, 8)}</span>
      </div>

      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-[#555] text-xs mb-1">WALLET</div>
            <div className="text-white font-mono text-sm break-all">{wallet}</div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button
              onClick={() => setActiveList(activeList === "followers" ? null : "followers")}
              className="flex flex-col items-center group"
            >
              <span className={`font-semibold text-base transition-colors ${activeList === "followers" ? "text-[#00ff88]" : "text-white group-hover:text-[#00ff88]"}`}>
                {followStats?.followerCount ?? 0}
              </span>
              <span className="text-[#555]">followers</span>
            </button>
            <div className="w-px h-6 bg-[#1a1a1a]" />
            <button
              onClick={() => setActiveList(activeList === "following" ? null : "following")}
              className="flex flex-col items-center group"
            >
              <span className={`font-semibold text-base transition-colors ${activeList === "following" ? "text-[#00ff88]" : "text-white group-hover:text-[#00ff88]"}`}>
                {followStats?.followingCount ?? 0}
              </span>
              <span className="text-[#555]">following</span>
            </button>
          </div>
        </div>
      </div>

      {/* Followers / Following list */}
      {activeList && (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
            <div className="text-white text-sm font-semibold capitalize">{activeList}</div>
            <button onClick={() => setActiveList(null)} className="text-[#555] hover:text-white text-xs transition-colors">✕ close</button>
          </div>
          {(activeList === "followers" ? followersLoading : followingLoading) ? (
            <div className="p-6 text-center text-[#555] text-sm">Loading…</div>
          ) : activeList === "followers" ? (
            (followersData?.followers ?? []).length === 0 ? (
              <div className="p-6 text-center text-[#555] text-sm">No followers yet.</div>
            ) : (
              <div>
                {(followersData?.followers ?? []).map((f) => (
                  <Link
                    key={f.follower}
                    href={`/portfolio/${f.follower}`}
                    className="flex items-center justify-between px-4 py-3 border-b border-[#111] last:border-0 hover:bg-[#111] transition-colors"
                  >
                    <span className="text-[#888] font-mono text-xs hover:text-white transition-colors">{truncateAddress(f.follower, 8)}</span>
                    <span className="text-[#444] text-[10px]">{timeAgo(f.createdAt)}</span>
                  </Link>
                ))}
              </div>
            )
          ) : (
            (followingData?.following ?? []).length === 0 ? (
              <div className="p-6 text-center text-[#555] text-sm">Not following anyone yet.</div>
            ) : (
              <div>
                {(followingData?.following ?? []).map((f) => (
                  <Link
                    key={f.following}
                    href={`/portfolio/${f.following}`}
                    className="flex items-center justify-between px-4 py-3 border-b border-[#111] last:border-0 hover:bg-[#111] transition-colors"
                  >
                    <span className="text-[#888] font-mono text-xs hover:text-white transition-colors">{truncateAddress(f.following, 8)}</span>
                    <span className="text-[#444] text-[10px]">{timeAgo(f.createdAt)}</span>
                  </Link>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Badges */}
      {!tradesLoading && !tokensLoading && badges.length > 0 && (
        <div>
          <div className="text-white font-semibold mb-3 text-sm">Badges</div>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <div
                key={b.label}
                title={b.description}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold"
                style={{ borderColor: b.color + "40", backgroundColor: b.color + "15", color: b.color }}
              >
                <span>{b.icon}</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary stats */}
      {tradesLoading || portfolioLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-[#111] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Buys" value={summary?.totalBuys ?? "0"} />
          <StatCard label="Total Sells" value={summary?.totalSells ?? "0"} />
          <StatCard
            label="SOL Spent"
            value={`${(portfolioData?.totalSpentSol ?? Number(summary?.totalSpentSol ?? 0)).toFixed(4)} SOL`}
          />
          <StatCard
            label="Realized PnL"
            value={`${realizedPnlSol >= 0 ? "+" : ""}${realizedPnlSol.toFixed(4)} SOL`}
            accent={realizedPnlSol >= 0}
          />
        </div>
      )}

      {/* New trader welcome banner */}
      {!tradesLoading && trades.length === 0 && (
        <div className="bg-[#00ff8808] border border-[#00ff8820] rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-3xl">👋</div>
          <div className="flex-1">
            <div className="text-white font-semibold mb-1">New trader</div>
            <div className="text-[#555] text-sm">
              This wallet hasn&apos;t made any trades yet. Buy a token to get started — your holdings and PnL will appear here automatically.
            </div>
          </div>
          <Link
            href="/"
            className="shrink-0 px-4 py-2 bg-[#00ff88] text-black text-sm font-semibold rounded-lg hover:bg-[#00cc6a] transition-colors"
          >
            Browse tokens →
          </Link>
        </div>
      )}

      {/* Holdings — hidden for new traders (banner shown instead) */}
      {(tradesLoading || portfolioLoading || trades.length > 0) && <div>
        <div className="text-white font-semibold mb-3">
          Holdings{" "}
          <span className="text-[#555] font-normal text-sm">({activeHoldings.length})</span>
        </div>
        {tradesLoading || portfolioLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-[#111] rounded-xl animate-pulse" />)}
          </div>
        ) : activeHoldings.length === 0 && trades.length > 0 ? (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6 text-center text-[#555] text-sm">
            No active holdings — all positions closed.
          </div>
        ) : activeHoldings.length === 0 ? null : (
          <div className="overflow-x-auto rounded-xl">
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden min-w-[340px]">
            <div className="grid grid-cols-[1fr_80px_100px_80px] gap-2 px-4 py-2 border-b border-[#1a1a1a] text-[#444] text-[10px] uppercase tracking-wider">
              <div>Token</div>
              <div className="text-right">Balance</div>
              <div className="text-right">SOL Spent</div>
              <div className="text-right">Real. PnL</div>
            </div>
            {activeHoldings.map((h) => {
              const pnlPositive = h.realizedPnlSol >= 0;
              return (
                <Link
                  key={h.mint}
                  href={`/token/${h.mint}`}
                  className="grid grid-cols-[1fr_80px_100px_80px] gap-2 px-4 py-3 border-b border-[#0f0f0f] hover:bg-[#0f0f0f] transition-colors items-center last:border-0"
                >
                  {/* Token info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0 flex items-center justify-center">
                      {resolveImageUrl(h.imageUrl) ? (
                        <img src={resolveImageUrl(h.imageUrl)!} alt={h.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[#00ff88] font-bold text-[10px]">{h.symbol.slice(0, 2)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white text-xs font-semibold truncate">{h.name}</div>
                      <div className="text-[#555] text-[10px]">${h.symbol}</div>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-right">
                    <div className="text-white text-xs font-mono">{h.tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="text-[#555] text-[10px]">{h.symbol}</div>
                  </div>

                  {/* SOL Spent */}
                  <div className="text-right">
                    <div className="text-[#888] text-xs font-mono">{h.costBasisSol.toFixed(4)}</div>
                    <div className="text-[#444] text-[10px]">SOL</div>
                  </div>

                  {/* Realized PnL */}
                  <div className="text-right">
                    <div className={`text-xs font-mono font-semibold ${pnlPositive ? "text-[#00ff88]" : "text-[#ff4444]"}`}>
                      {h.realizedPnlSol !== 0 ? (pnlPositive ? "+" : "") + h.realizedPnlSol.toFixed(4) + " SOL" : "—"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          </div>
        )}
      </div>}

      {/* Tokens created */}
      <div>
        <div className="text-white font-semibold mb-3">
          Tokens Created{" "}
          <span className="text-[#555] font-normal text-sm">({createdTokens.length})</span>
        </div>
        {tokensLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-[#111] rounded-xl animate-pulse" />)}
          </div>
        ) : createdTokens.length === 0 ? (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6 text-center text-[#555] text-sm">
            No tokens created yet.{" "}
            <Link href="/launch" className="text-[#00ff88] hover:underline">Launch one →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {createdTokens.map((token: any) => (
              <Link key={token.mint} href={`/token/${token.mint}`}
                className="flex items-center gap-3 bg-[#111] border border-[#1a1a1a] hover:border-[#2a2a2a] rounded-xl p-3 transition-colors">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0 flex items-center justify-center">
                  {resolveImageUrl(token.imageUrl) ? (
                    <img src={resolveImageUrl(token.imageUrl)!} alt={token.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#00ff88] font-bold text-xs">{token.symbol.slice(0, 2)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-semibold">{token.name}
                    <span className="text-[#555] font-normal ml-2 text-xs">${token.symbol}</span>
                  </div>
                  <div className="text-[#555] text-xs">{timeAgo(token.createdAt)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white text-sm font-mono">{token.marketCapSol.toFixed(2)} SOL</div>
                  <div className="text-[#555] text-xs">{token.trades} trades</div>
                </div>
                {token.isGraduated && (
                  <span className="text-[#a78bfa] text-xs border border-[#7c3aed40] px-2 py-0.5 rounded-full">🎓</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Trade history — hidden for new traders */}
      {(tradesLoading || trades.length > 0) && <div>
        <div className="text-white font-semibold mb-3">
          Trade History{" "}
          <span className="text-[#555] font-normal text-sm">({trades.length})</span>
        </div>
        {tradesLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-[#111] rounded-xl animate-pulse" />)}
          </div>
        ) : trades.length === 0 ? null : (
          <div className="overflow-x-auto rounded-xl">
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden min-w-[360px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="text-left text-[#555] p-3 font-medium">TOKEN</th>
                  <th className="text-left text-[#555] p-3 font-medium">TYPE</th>
                  <th className="text-right text-[#555] p-3 font-medium">SOL</th>
                  <th className="text-right text-[#555] p-3 font-medium hidden sm:table-cell">TOKENS</th>
                  <th className="text-right text-[#555] p-3 font-medium">TIME</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade: any) => (
                  <tr key={trade.id} className="border-b border-[#0f0f0f] hover:bg-[#0f0f0f] transition-colors">
                    <td className="p-3">
                      <Link href={`/token/${trade.mint}`} className="text-[#888] hover:text-white transition-colors font-mono">
                        {trade.token?.symbol ?? truncateAddress(trade.mint)}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        trade.type === "BUY"
                          ? "bg-[#00ff8815] text-[#00ff88]"
                          : "bg-[#ff444415] text-[#ff4444]"
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-white">
                      {(Number(trade.solAmount) / 1e9).toFixed(4)}
                    </td>
                    <td className="p-3 text-right font-mono text-[#888] hidden sm:table-cell">
                      {Number(trade.tokenAmount / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3 text-right text-[#555]">{timeAgo(trade.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>}
    </div>
  );
}
