"use client";

import React from "react";
import { clsx } from "clsx";
import { useTrades } from "@/hooks/useTrades";
import { truncateAddress, timeAgo } from "@/lib/api";

interface TradesListProps {
  mint: string;
  symbol: string;
}

export function TradesList({ mint, symbol }: TradesListProps) {
  const { trades, isLoading } = useTrades(mint);

  if (isLoading) {
    return (
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
        <div className="text-sm text-white font-semibold mb-4">Trades</div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-[#1a1a1a] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Buy/sell pressure from recent 50 trades
  const buys = trades.filter((t) => t.type === "BUY");
  const sells = trades.filter((t) => t.type === "SELL");
  const buyVol = buys.reduce((s, t) => s + Number(t.solAmount), 0);
  const sellVol = sells.reduce((s, t) => s + Number(t.solAmount), 0);
  const totalVol = buyVol + sellVol;
  const buyPct = totalVol > 0 ? (buyVol / totalVol) * 100 : 50;
  const sellPct = 100 - buyPct;

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex justify-between items-center">
        <span className="text-white text-sm font-semibold">Recent Trades</span>
        <span className="text-[#555] text-xs">{trades.length} trades</span>
      </div>

      {/* Buy/Sell pressure bar */}
      {trades.length > 0 && (
        <div className="px-4 py-2.5 border-b border-[#1a1a1a]">
          <div className="flex justify-between text-[10px] mb-1.5">
            <span className="text-[#00ff88] font-semibold">
              BUY {buyPct.toFixed(0)}%
            </span>
            <span className="text-[#555] text-[10px]">Buy / Sell Pressure</span>
            <span className="text-[#ff4444] font-semibold">
              {sellPct.toFixed(0)}% SELL
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-[#00ff88] transition-all duration-500"
              style={{ width: `${buyPct}%` }}
            />
            <div
              className="h-full bg-[#ff4444] transition-all duration-500 flex-1"
            />
          </div>
        </div>
      )}

      {/* Column headers */}
      {trades.length > 0 && (
        <div className="grid grid-cols-5 px-4 py-2 text-[#444] text-[10px] border-b border-[#0f0f0f]">
          <span>ACCOUNT</span>
          <span>TYPE</span>
          <span className="text-right">SOL</span>
          <span className="text-right">{symbol}</span>
          <span className="text-right">TIME</span>
        </div>
      )}

      {/* Trades */}
      <div className="overflow-y-auto max-h-[400px]">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#333]">
            <div className="text-3xl mb-2">💸</div>
            <div className="text-sm">No trades yet</div>
            <div className="text-xs text-[#444] mt-1">Be the first to trade!</div>
          </div>
        ) : (
          trades.map((trade) => {
            const isBuy = trade.type === "BUY";
            const solAmt = (Number(trade.solAmount) / 1e9).toFixed(3);
            const tokenAmt = (Number(trade.tokenAmount) / 1_000_000).toFixed(0);

            return (
              <div
                key={trade.id}
                className={clsx(
                  "grid grid-cols-5 px-4 py-2.5 border-b border-[#0a0a0a] text-xs hover:bg-[#0f0f0f] transition-colors",
                  "animate-slide-in"
                )}
              >
                <span className="text-[#666] font-mono">
                  {truncateAddress(trade.trader, 4)}
                </span>
                <span
                  className={clsx(
                    "font-semibold",
                    isBuy ? "text-[#00ff88]" : "text-[#ff4444]"
                  )}
                >
                  {isBuy ? "BUY" : "SELL"}
                </span>
                <span className="text-right font-mono text-white">{solAmt}</span>
                <span className="text-right font-mono text-[#888]">
                  {parseInt(tokenAmt).toLocaleString()}
                </span>
                <span className="text-right text-[#444]">
                  {timeAgo(trade.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
