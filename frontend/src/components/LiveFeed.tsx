"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { useLiveFeed, FeedItem } from "@/hooks/useLiveFeed";
import { truncateAddress, timeAgo } from "@/lib/api";
import { formatSol } from "@/lib/bondingCurve";
import BN from "bn.js";

function FeedEntry({ item }: { item: FeedItem }) {
  const [flash, setFlash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setFlash(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (item.type === "TOKEN_CREATED") {
    return (
      <Link href={`/token/${item.mint}`}>
        <div
          className={clsx(
            "px-3 py-2 border-b border-[#0f0f0f] hover:bg-[#111] transition-colors cursor-pointer",
            flash && "animate-flash-green"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">🚀</span>
            <div className="flex-1 min-w-0">
              <div className="text-[#00ff88] text-xs font-medium">
                New token launched!
              </div>
              <div className="text-white text-xs font-medium truncate">
                {item.tokenName} ({item.tokenSymbol})
              </div>
              <div className="text-[#555] text-[10px]">
                by {item.trader ? truncateAddress(item.trader) : "unknown"}
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (item.type === "GRADUATED") {
    return (
      <Link href={`/token/${item.mint}`}>
        <div className={clsx("px-3 py-2 border-b border-[#0f0f0f] cursor-pointer", flash && "animate-flash-green")}>
          <div className="flex items-center gap-2">
            <span className="text-sm">🎓</span>
            <div>
              <div className="text-[#a78bfa] text-xs font-medium">Graduated!</div>
              <div className="text-white text-xs">{item.tokenName || truncateAddress(item.mint)}</div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  const isBuy = item.type === "BUY";
  const solAmt = item.solAmount ? (Number(item.solAmount) / 1e9).toFixed(3) : "?";

  return (
    <Link href={`/token/${item.mint}`}>
      <div
        className={clsx(
          "px-3 py-2 border-b border-[#0f0f0f] hover:bg-[#111] transition-colors cursor-pointer",
          flash && (isBuy ? "animate-flash-green" : "animate-flash-red")
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              "w-1.5 h-1.5 rounded-full shrink-0",
              isBuy ? "bg-[#00ff88]" : "bg-[#ff4444]"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[#666] text-[10px]">
                {item.trader ? truncateAddress(item.trader) : "?"}
              </span>
              <span
                className={clsx(
                  "text-[10px] font-semibold",
                  isBuy ? "text-[#00ff88]" : "text-[#ff4444]"
                )}
              >
                {isBuy ? "bought" : "sold"}
              </span>
              <span className="text-white text-[10px] font-mono">{solAmt} SOL</span>
              <span className="text-[#555] text-[10px]">of</span>
              <span className="text-[#888] text-[10px] font-medium truncate">
                {item.tokenSymbol || truncateAddress(item.mint, 3)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function LiveFeed() {
  const { feed, isConnected } = useLiveFeed(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [feed, autoScroll]);

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl flex flex-col h-full min-h-[320px] max-h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-2">
          <div className="live-dot" />
          <span className="text-white text-sm font-semibold">Live Feed</span>
        </div>
        <div
          className={clsx(
            "text-[10px] px-2 py-0.5 rounded-full border",
            isConnected
              ? "text-[#00ff88] border-[#00ff8830] bg-[#00ff8810]"
              : "text-[#ff4444] border-[#ff444430] bg-[#ff444410]"
          )}
        >
          {isConnected ? "LIVE" : "CONNECTING..."}
        </div>
      </div>

      {/* Feed */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAutoScroll(el.scrollTop === 0);
        }}
      >
        {feed.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-[#333]">
            <div className="text-4xl mb-3">📡</div>
            <div className="text-sm">Waiting for trades...</div>
            <div className="mt-1 text-xs text-[#2f3a37]">Fresh activity will stream here</div>
          </div>
        ) : (
          feed.map((item) => <FeedEntry key={item.id} item={item} />)
        )}
      </div>

      {/* Scroll hint */}
      {!autoScroll && (
        <button
          onClick={() => {
            if (containerRef.current) containerRef.current.scrollTop = 0;
            setAutoScroll(true);
          }}
          className="shrink-0 py-2 text-[#00ff88] text-xs text-center bg-[#00ff8810] hover:bg-[#00ff8820] transition-colors border-t border-[#00ff8820]"
        >
          Back to top
        </button>
      )}
    </div>
  );
}
