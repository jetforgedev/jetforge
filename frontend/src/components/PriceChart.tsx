"use client";

import React, { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { getOHLCV, getTrades } from "@/lib/api";
import { useSocket } from "@/hooks/useLiveFeed";

type Interval = "1s" | "1m" | "5m" | "15m" | "30m" | "1h" | "1d";

interface PriceChartProps {
  mint: string;
  symbol: string;
  solPrice: number | null;
  creator?: string;
}

export function PriceChart({ mint, symbol, solPrice, creator }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [interval, setInterval] = useState<Interval>("5m");
  const socket = useSocket();

  const { data: ohlcv, isLoading } = useQuery({
    queryKey: ["ohlcv", mint, interval],
    queryFn: () => getOHLCV(mint, interval, 200),
    staleTime: 30_000,
  });

  // Fetch all trades to find dev buy/sell events
  const { data: tradesData } = useQuery({
    queryKey: ["trades-markers", mint],
    queryFn: () => getTrades(mint, 1, 500),
    staleTime: 60_000,
    enabled: !!creator,
  });

  // Initialize chart — cleanup stored in a shared object so the return fn can access it
  // even though chart creation is async (dynamic import)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Shared cleanup state between async init and the React cleanup fn
    const state: { chart: any; observer: ResizeObserver | null; destroyed: boolean } = {
      chart: null,
      observer: null,
      destroyed: false,
    };

    import("lightweight-charts").then(({ createChart, CrosshairMode }) => {
      // Component may have unmounted before the import resolved
      if (state.destroyed || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: "#0d0d0d" },
          textColor: "#555",
        },
        grid: {
          vertLines: { color: "#111" },
          horzLines: { color: "#111" },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#1a1a1a", textColor: "#555" },
        timeScale: {
          borderColor: "#1a1a1a",
          timeVisible: true,
          secondsVisible: interval === "1s",
          rightOffset: 5,
        },
        width: chartContainerRef.current.clientWidth,
        height: 440,
      });

      // Market cap formatter: shows $2.4K, $11.5K, $1.2M instead of raw numbers
      const mcapFormatter = (price: number) => {
        if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
        if (price >= 1_000)     return `$${(price / 1_000).toFixed(1)}K`;
        return `$${price.toFixed(2)}`;
      };

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#00ff88",
        downColor: "#ff4444",
        borderUpColor: "#00ff88",
        borderDownColor: "#ff4444",
        wickUpColor: "#00ff8880",
        wickDownColor: "#ff444480",
        priceFormat: { type: "custom", formatter: mcapFormatter, minMove: 0.01 },
      });

      const volumeSeries = chart.addHistogramSeries({
        color: "#1a1a1a",
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      state.chart = chart;
      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;

      const resizeObserver = new ResizeObserver(() => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      });
      resizeObserver.observe(chartContainerRef.current);
      state.observer = resizeObserver;
    });

    return () => {
      state.destroyed = true;
      state.observer?.disconnect();
      state.chart?.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Update secondsVisible when interval changes (chart init uses stale closure)
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      timeScale: { secondsVisible: interval === "1s" },
    });
  }, [interval]);

  // Update candle + volume data when OHLCV or solPrice changes
  // Y-axis shows Market Cap in USD: stored price × 1,000,000 × solPrice
  // Derivation: price = virtualSol/virtualTokens; mcap_SOL = price × TOTAL_SUPPLY/1e9 = price × 1e6
  useEffect(() => {
    if (!candleSeriesRef.current || !ohlcv || ohlcv.length === 0) return;

    // When solPrice not loaded yet, show market cap in SOL (×1M factor only)
    const priceMultiplier = (solPrice ?? 1) * 1_000_000;
    const candles = ohlcv.map((d) => ({
      time: d.time as any,
      open: d.open * priceMultiplier,
      high: d.high * priceMultiplier,
      low: d.low * priceMultiplier,
      close: d.close * priceMultiplier,
    }));

    const volumes = ohlcv.map((d) => ({
      time: d.time as any,
      value: d.volume,
      color: d.close >= d.open ? "#00ff8830" : "#ff444430",
    }));

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current?.setData(volumes);
    chartRef.current?.timeScale().fitContent();
  }, [ohlcv, solPrice]);

  // Dev buy/sell markers — refresh whenever trades or ohlcv change
  useEffect(() => {
    if (!candleSeriesRef.current || !creator || !tradesData?.trades?.length) return;

    const devTrades = tradesData.trades.filter((t) => t.trader === creator);
    if (devTrades.length === 0) {
      candleSeriesRef.current.setMarkers([]);
      return;
    }

    const markers = devTrades
      .map((t) => ({
        time: Math.floor(new Date(t.timestamp).getTime() / 1000) as any,
        position: t.type === "BUY" ? ("belowBar" as const) : ("aboveBar" as const),
        color: t.type === "BUY" ? "#00ff88" : "#ff4444",
        shape: t.type === "BUY" ? ("arrowUp" as const) : ("arrowDown" as const),
        text: t.type === "BUY" ? "Dev ▲" : "Dev ▼",
        size: 1,
      }))
      .sort((a, b) => a.time - b.time);

    candleSeriesRef.current.setMarkers(markers);
  }, [tradesData, creator, ohlcv]);

  // Live trade flash notifications
  const [flashTrade, setFlashTrade] = useState<{
    type: "BUY" | "SELL";
    trader: string;
    solAmount: string;
  } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!socket || !mint) return;

    socket.on("new_trade", (trade: any) => {
      if (trade.mint !== mint) return;
      setFlashTrade({
        type: trade.type,
        trader: trade.trader,
        solAmount: trade.solAmount,
      });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashTrade(null), 4000);
    });

    return () => {
      socket.off("new_trade");
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [socket, mint]);

  // Real-time price updates via Socket.IO
  useEffect(() => {
    if (!socket || !mint || !candleSeriesRef.current) return;

    socket.on("price_update", (_data: any) => {
      // TODO: update last candle tick
    });

    return () => {
      socket.off("price_update");
    };
  }, [socket, mint]);

  const intervals: { label: string; value: Interval }[] = [
    { label: "1s",  value: "1s"  },
    { label: "1m",  value: "1m"  },
    { label: "5m",  value: "5m"  },
    { label: "15m", value: "15m" },
    { label: "30m", value: "30m" },
    { label: "1h",  value: "1h"  },
    { label: "1d",  value: "1d"  },
  ];

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="text-white text-sm font-semibold">{symbol}</div>
            <div className="text-[#555] text-xs">Market Cap</div>
          </div>
          {/* Current price display */}
          {ohlcv && ohlcv.length > 0 && (() => {
            // stored close = virtualSol(lamports) / virtualTokens(raw units)
            // price per token in SOL = close / 1000
            const lastClose = ohlcv[ohlcv.length - 1].close;
            const pricePerTokenSol = lastClose / 1000;
            return (
              <div className="text-[#888] text-xs font-mono">
                Price:{" "}
                <span className="text-white">
                  {solPrice
                    ? `$${(pricePerTokenSol * solPrice).toFixed(8)}`
                    : `${pricePerTokenSol.toFixed(8)} SOL`}
                </span>
              </div>
            );
          })()}
          {creator && (
            <div className="flex items-center gap-2 text-[10px] text-[#555]">
              <span className="text-[#00ff88]">▲</span> Dev Buy
              <span className="text-[#ff4444] ml-1">▼</span> Dev Sell
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {intervals.map((i) => (
            <button
              key={i.value}
              onClick={() => setInterval(i.value)}
              className={clsx(
                "px-2.5 py-1 text-xs rounded font-medium transition-colors",
                interval === i.value
                  ? "bg-[#00ff8820] text-[#00ff88]"
                  : "text-[#555] hover:text-[#888]"
              )}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {/* Live trade flash notification */}
        {flashTrade && (
          <div
            className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold shadow-lg animate-slide-in"
            style={{
              background: flashTrade.type === "BUY" ? "#00ff8815" : "#ff444415",
              borderColor: flashTrade.type === "BUY" ? "#00ff8840" : "#ff444440",
              color: flashTrade.type === "BUY" ? "#00ff88" : "#ff4444",
            }}
          >
            <span>{flashTrade.type === "BUY" ? "▲" : "▼"}</span>
            <span>{flashTrade.trader.slice(0, 4)}...{flashTrade.trader.slice(-4)}</span>
            <span className="text-white font-mono">
              {(Number(flashTrade.solAmount) / 1e9).toFixed(3)} SOL
            </span>
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d0d] z-10">
            <div className="flex items-center gap-2 text-[#555]">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading chart...</span>
            </div>
          </div>
        )}
        {!isLoading && (!ohlcv || ohlcv.length === 0) && (
          <div className="h-[440px] flex items-center justify-center text-[#333]">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <div className="text-sm">No chart data yet</div>
              <div className="text-xs text-[#444] mt-1">Make the first trade!</div>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" />
      </div>
    </div>
  );
}
