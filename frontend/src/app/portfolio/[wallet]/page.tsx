"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { getUserTrades, getTokensByCreator, truncateAddress, timeAgo } from "@/lib/api";

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
  const { data: tradesData, isLoading: tradesLoading } = useQuery({
    queryKey: ["portfolio-trades", wallet],
    queryFn: () => getUserTrades(wallet),
  });

  const { data: tokensData, isLoading: tokensLoading } = useQuery({
    queryKey: ["portfolio-tokens", wallet],
    queryFn: () => getTokensByCreator(wallet),
  });

  const summary = tradesData?.summary;
  const trades = tradesData?.trades ?? [];
  const createdTokens = tokensData?.tokens ?? [];

  const pnl = parseFloat(summary?.realizedPnl ?? "0");

  // Compute per-token holdings from trade history
  const holdings = useMemo(() => {
    if (!trades.length) return [];

    const byMint: Record<string, {
      mint: string;
      symbol: string;
      name: string;
      imageUrl?: string;
      tokensBought: number;
      tokensSold: number;
      solSpent: number;
      solReceived: number;
    }> = {};

    for (const t of trades) {
      if (!byMint[t.mint]) {
        byMint[t.mint] = {
          mint: t.mint,
          symbol: t.token?.symbol ?? "?",
          name: t.token?.name ?? t.mint.slice(0, 8),
          imageUrl: t.token?.imageUrl,
          tokensBought: 0,
          tokensSold: 0,
          solSpent: 0,
          solReceived: 0,
        };
      }
      const tokens = Number(t.tokenAmount) / 1_000_000;
      const sol = Number(t.solAmount) / 1e9;
      if (t.type === "BUY") {
        byMint[t.mint].tokensBought += tokens;
        byMint[t.mint].solSpent += sol;
      } else {
        byMint[t.mint].tokensSold += tokens;
        byMint[t.mint].solReceived += sol;
      }
    }

    return Object.values(byMint).map((d) => {
      const netTokens = d.tokensBought - d.tokensSold;
      const avgBuyPrice = d.tokensBought > 0 ? d.solSpent / d.tokensBought : 0;
      const realizedPnl = d.solReceived - d.tokensSold * avgBuyPrice;
      const costBasisHeld = netTokens * avgBuyPrice;
      return { ...d, netTokens, avgBuyPrice, realizedPnl, costBasisHeld };
    }).sort((a, b) => b.netTokens - a.netTokens);
  }, [trades]);

  const activeHoldings = holdings.filter((h) => h.netTokens > 0.001);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/" className="text-[#555] hover:text-[#888] text-xs transition-colors">Home</Link>
        <span className="text-[#333]">/</span>
        <span className="text-[#888] text-xs font-mono">{truncateAddress(wallet, 8)}</span>
      </div>

      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
        <div className="text-[#555] text-xs mb-1">WALLET</div>
        <div className="text-white font-mono text-sm break-all">{wallet}</div>
      </div>

      {/* Summary stats */}
      {tradesLoading ? (
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
            value={`${summary?.totalSpentSol ?? "0"} SOL`}
          />
          <StatCard
            label="Realized PnL"
            value={`${pnl >= 0 ? "+" : ""}${summary?.realizedPnl ?? "0"} SOL`}
            accent={pnl >= 0}
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
      {(tradesLoading || trades.length > 0) && <div>
        <div className="text-white font-semibold mb-3">
          Holdings{" "}
          <span className="text-[#555] font-normal text-sm">({activeHoldings.length})</span>
        </div>
        {tradesLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-[#111] rounded-xl animate-pulse" />)}
          </div>
        ) : activeHoldings.length === 0 && trades.length > 0 ? (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6 text-center text-[#555] text-sm">
            No active holdings — all positions closed.
          </div>
        ) : activeHoldings.length === 0 ? null : (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_100px_80px] gap-2 px-4 py-2 border-b border-[#1a1a1a] text-[#444] text-[10px] uppercase tracking-wider">
              <div>Token</div>
              <div className="text-right">Balance</div>
              <div className="text-right">SOL Spent</div>
              <div className="text-right">Real. PnL</div>
            </div>
            {activeHoldings.map((h) => {
              const pnlPositive = h.realizedPnl >= 0;
              return (
                <Link
                  key={h.mint}
                  href={`/token/${h.mint}`}
                  className="grid grid-cols-[1fr_80px_100px_80px] gap-2 px-4 py-3 border-b border-[#0f0f0f] hover:bg-[#0f0f0f] transition-colors items-center last:border-0"
                >
                  {/* Token info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0 flex items-center justify-center">
                      {h.imageUrl ? (
                        <Image src={h.imageUrl} alt={h.name} width={32} height={32} className="object-cover" unoptimized />
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
                    <div className="text-white text-xs font-mono">{h.netTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="text-[#555] text-[10px]">{h.symbol}</div>
                  </div>

                  {/* SOL Spent */}
                  <div className="text-right">
                    <div className="text-[#888] text-xs font-mono">{h.solSpent.toFixed(4)}</div>
                    <div className="text-[#444] text-[10px]">SOL</div>
                  </div>

                  {/* Realized PnL */}
                  <div className="text-right">
                    <div className={`text-xs font-mono font-semibold ${pnlPositive ? "text-[#00ff88]" : "text-[#ff4444]"}`}>
                      {h.realizedPnl !== 0 ? (pnlPositive ? "+" : "") + h.realizedPnl.toFixed(4) + " SOL" : "—"}
                    </div>
                  </div>
                </Link>
              );
            })}
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
                  {token.imageUrl ? (
                    <Image src={token.imageUrl} alt={token.name} width={40} height={40} className="object-cover" unoptimized />
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
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
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
        )}
      </div>}
    </div>
  );
}
