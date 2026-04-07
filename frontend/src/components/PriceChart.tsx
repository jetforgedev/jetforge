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

const INTERVAL_MS: Record<Interval, number> = {
  "1s": 1_000, "1m": 60_000, "5m": 300_000,
  "15m": 900_000, "30m": 1_800_000, "1h": 3_600_000, "1d": 86_400_000,
};

export function PriceChart({ mint, symbol, solPrice, creator }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  // Track current live candle so we keep correct open/high/low
  const liveCandle = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  const [interval, setInterval] = useState<Interval>("1m");
  const socket = useSocket();

  const { data: ohlcv, isLoading } = useQuery({
    queryKey: ["ohlcv", mint, interval],
    queryFn: () => getOHLCV(mint, interval, 200),
    staleTime: 30_000,
  });

  // Only fetch dev trades if a creator is provided
  const { data: tradesData } = useQuery({
    queryKey: ["trades-markers", mint],
    queryFn: () => getTrades(mint, 1, 500),
    staleTime: 60_000,
    enabled: !!creator,
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const state: { chart: any; observer: ResizeObserver | null; destroyed: boolean } = {
      chart: null, observer: null, destroyed: false,
    };

    import("lightweight-charts").then(({ createChart, CrosshairMode }) => {
      if (state.destroyed || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        layout: { background: { color: "#0d0d0d" }, textColor: "#555" },
        grid: { vertLines: { color: "#111" }, horzLines: { color: "#111" } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#1a1a1a", textColor: "#555" },
        timeScale: {
          borderColor: "#1a1a1a",
          timeVisible: true,
          secondsVisible: interval === "1s",
          rightOffset: 5,
        },
        width: chartContainerRef.current.clientWidth,
        height: 400,
      });

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
      liveCandle.current = null;
    };
  }, []);

  // Update secondsVisible when interval changes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      timeScale: { secondsVisible: interval === "1s" },
    });
    liveCandle.current = null;
  }, [interval]);

  // Load OHLCV data
  useEffect(() => {
    if (!candleSeriesRef.current || !ohlcv || ohlcv.length === 0) return;

    const priceMultiplier = (solPrice ?? 1) * 1_000_000;
    const candles = ohlcv.map((d) => ({
      time: d.time as any,
      open:  d.open  * priceMultiplier,
      high:  d.high  * priceMultiplier,
      low:   d.low   * priceMultiplier,
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

    // Seed liveCandle with the last known candle so real-time updates continue it
    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      liveCandle.current = {
        time: last.time as number,
        open: last.open, high: last.high, low: last.low, close: last.close,
      };
    }
  }, [ohlcv, solPrice]);

  // Dev buy/sell markers — small dots only, no text
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
        color: t.type === "BUY" ? "#00ff8880" : "#ff444480",
        shape: "circle" as const,
        text: "",
        size: 0.5,
      }))
      .sort((a, b) => a.time - b.time);

    candleSeriesRef.current.setMarkers(markers);
  }, [tradesData, creator, ohlcv]);

  // Live trade flash
  const [flashTrade, setFlashTrade] = useState<{ type: "BUY" | "SELL"; trader: string; solAmount: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!socket || !mint) return;

    socket.on("new_trade", (trade: any) => {
      if (trade.mint !== mint) return;
      setFlashTrade({ type: trade.type, trader: trade.trader, solAmount: trade.solAmount });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashTrade(null), 4000);
    });

    return () => {
      socket.off("new_trade");
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [socket, mint]);

  const intervalRef = useRef(interval);
  const solPriceRef = useRef(solPrice);
  useEffect(() => { intervalRef.current = interval; }, [interval]);
  useEffect(() => { solPriceRef.current = solPrice; }, [solPrice]);

  // Real-time candle updates — properly maintain open/high/low/close
  useEffect(() => {
    if (!socket || !mint) return;

    socket.on("price_update", (data: any) => {
      if (data.mint !== mint) return;
      if (!candleSeriesRef.current) return;

      const ms = INTERVAL_MS[intervalRef.current] ?? 60_000;
      const priceMultiplier = (solPriceRef.current ?? 1) * 1_000_000;
      const candleTime = (Math.floor((data.timestamp * 1000) / ms) * ms) / 1000;
      const val = data.price * priceMultiplier;

      const prev = liveCandle.current;

      let updated: typeof prev;

      if (prev && prev.time === candleTime) {
        // Same candle — update high, low, close but keep open
        updated = {
          time: candleTime,
          open:  prev.open,
          high:  Math.max(prev.high, val),
          low:   Math.min(prev.low,  val),
          close: val,
        };
      } else {
        // New candle bucket
        updated = { time: candleTime, open: val, high: val, low: val, close: val };
      }

      liveCandle.current = updated;

      try {
        candleSeriesRef.current.update({
          time:  updated.time as any,
          open:  updated.open,
          high:  updated.high,
          low:   updated.low,
          close: updated.close,
        });
      } catch {
        // time went backwards — safe to ignore
      }
    });

    return () => { socket.off("price_update"); };
  }, [socket, mint]);

  const intervals: { label: string; value: Interval }[] = [
    { label: "1s", value: "1s" }, { label: "1m", value: "1m" },
    { label: "5m", value: "5m" }, { label: "15m", value: "15m" },
    { label: "30m", value: "30m" }, { label: "1h", value: "1h" },
    { label: "1d", value: "1d" },
  ];

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-white text-sm font-semibold">{symbol}</span>
          <span className="text-[#555] text-xs">Market Cap</span>
          {ohlcv && ohlcv.length > 0 && (() => {
            const lastClose = ohlcv[ohlcv.length - 1].close;
            const pricePerTokenSol = lastClose / 1000;
            return (
              <span className="text-[#888] text-xs font-mono">
                Price:{" "}
                <span className="text-white">
                  {solPrice
                    ? `$${(pricePerTokenSol * solPrice).toFixed(8)}`
                    : `${pricePerTokenSol.toFixed(8)} SOL`}
                </span>
              </span>
            );
          })()}
        </div>
        <div className="flex gap-0.5">
          {intervals.map((i) => (
            <button
              key={i.value}
              onClick={() => setInterval(i.value)}
              className={clsx(
                "px-2 py-1 text-xs rounded font-medium transition-colors",
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
          <div className="h-[400px] flex items-center justify-center text-[#333]">
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
