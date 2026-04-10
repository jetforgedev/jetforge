"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { getOHLCV, getTrades } from "@/lib/api";
import { useSocket } from "@/hooks/useLiveFeed";

type Interval = "1s" | "1m" | "5m" | "15m" | "30m" | "1h" | "1d";
type PriceMode = "mcap" | "price";
type CurrencyMode = "usd" | "sol";

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

const TOTAL_SUPPLY = 1_000_000_000; // 1B tokens

function fmtMcap(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function fmtMcapSol(val: number): string {
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K SOL`;
  return `${val.toFixed(2)} SOL`;
}

export function PriceChart({ mint, symbol, solPrice, creator }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const liveCandle = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  const [interval, setInterval] = useState<Interval>("1m");
  const [priceMode, setPriceMode] = useState<PriceMode>("mcap");
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>("usd");
  const [showTrades, setShowTrades] = useState(true);
  const [showBubbles, setShowBubbles] = useState(true);

  // ATH tracking
  const [ath, setAth] = useState<number | null>(null);

  const socket = useSocket();

  const { data: ohlcv, isLoading } = useQuery({
    queryKey: ["ohlcv", mint, interval],
    queryFn: () => getOHLCV(mint, interval, 200),
    staleTime: 30_000,
  });

  const { data: tradesData } = useQuery({
    queryKey: ["trades-markers", mint],
    queryFn: () => getTrades(mint, 1, 500),
    staleTime: 60_000,
    enabled: showTrades,
  });

  // Compute display multiplier based on mode
  const getMultiplier = useCallback((sp: number | null) => {
    const solUsd = sp ?? 0;
    if (priceMode === "mcap") {
      // price (sol per token lamport) * supply / 1e9 * solUsd = mcap in USD
      // raw ohlcv values are already in SOL-per-1M-tokens units
      return currencyMode === "usd" ? solUsd * TOTAL_SUPPLY / 1_000_000 : TOTAL_SUPPLY / 1_000_000;
    } else {
      // per-token price
      return currencyMode === "usd" ? solUsd / 1_000_000 : 1 / 1_000_000;
    }
  }, [priceMode, currencyMode]);

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
          secondsVisible: false,
          rightOffset: 5,
        },
        width: chartContainerRef.current.clientWidth,
        height: 480,
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#00ff88",
        downColor: "#ff4444",
        borderUpColor: "#00ff88",
        borderDownColor: "#ff4444",
        wickUpColor: "#00ff8880",
        wickDownColor: "#ff444480",
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
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

  // Update interval config
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

    const mult = getMultiplier(solPrice);

    const candles = ohlcv.map((d) => ({
      time: d.time as any,
      open:  d.open  * mult,
      high:  d.high  * mult,
      low:   d.low   * mult,
      close: d.close * mult,
    }));

    const volumes = ohlcv.map((d) => ({
      time: d.time as any,
      value: d.volume,
      color: d.close >= d.open ? "#00ff8830" : "#ff444430",
    }));

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current?.setData(volumes);
    chartRef.current?.timeScale().fitContent();

    // Compute ATH
    const maxHigh = Math.max(...candles.map((c) => c.high));
    setAth(maxHigh);

    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      liveCandle.current = {
        time: last.time as number,
        open: last.open, high: last.high, low: last.low, close: last.close,
      };
    }
  }, [ohlcv, solPrice, priceMode, currencyMode, getMultiplier]);

  // Trade markers
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    if (!showTrades || !tradesData?.trades?.length) {
      candleSeriesRef.current.setMarkers([]);
      return;
    }

    const markers = tradesData.trades
      .map((t) => ({
        time: Math.floor(new Date(t.timestamp).getTime() / 1000) as any,
        position: t.type === "BUY" ? ("belowBar" as const) : ("aboveBar" as const),
        color: t.type === "BUY" ? "#00ff88" : "#ff4444",
        shape: "circle" as const,
        text: t.trader === creator
          ? (t.type === "BUY" ? "Dev Buy" : "Dev Sell")
          : "",
        size: 0.6,
      }))
      .sort((a, b) => a.time - b.time);

    candleSeriesRef.current.setMarkers(markers);
  }, [tradesData, creator, ohlcv, showTrades]);

  // Live trade flash bubble
  const [flashTrades, setFlashTrades] = useState<Array<{
    id: number; type: "BUY" | "SELL"; trader: string; solAmount: string;
  }>>([]);
  const flashIdRef = useRef(0);

  useEffect(() => {
    if (!socket || !mint) return;

    socket.on("new_trade", (trade: any) => {
      if (trade.mint !== mint) return;
      const id = ++flashIdRef.current;
      setFlashTrades((prev) => [...prev.slice(-4), { id, type: trade.type, trader: trade.trader, solAmount: trade.solAmount }]);
      setTimeout(() => {
        setFlashTrades((prev) => prev.filter((f) => f.id !== id));
      }, 5000);
    });

    return () => { socket.off("new_trade"); };
  }, [socket, mint]);

  const intervalRef = useRef(interval);
  const solPriceRef = useRef(solPrice);
  const getMult = useRef(getMultiplier);
  useEffect(() => { intervalRef.current = interval; }, [interval]);
  useEffect(() => { solPriceRef.current = solPrice; }, [solPrice]);
  useEffect(() => { getMult.current = getMultiplier; }, [getMultiplier]);

  // Real-time candle updates
  useEffect(() => {
    if (!socket || !mint) return;

    socket.on("price_update", (data: any) => {
      if (data.mint !== mint) return;
      if (!candleSeriesRef.current) return;

      const ms = INTERVAL_MS[intervalRef.current] ?? 60_000;
      const mult = getMult.current(solPriceRef.current);
      const candleTime = (Math.floor((data.timestamp * 1000) / ms) * ms) / 1000;
      const val = data.price * mult;

      const prev = liveCandle.current;
      let updated: typeof prev;

      if (prev && prev.time === candleTime) {
        updated = {
          time: candleTime,
          open: prev.open,
          high: Math.max(prev.high, val),
          low: Math.min(prev.low, val),
          close: val,
        };
      } else {
        updated = { time: candleTime, open: val, high: val, low: val, close: val };
      }

      liveCandle.current = updated;

      // Update ATH
      setAth((prev) => prev === null ? val : Math.max(prev, val));

      try {
        candleSeriesRef.current.update({ time: updated.time as any, open: updated.open, high: updated.high, low: updated.low, close: updated.close });
      } catch { /* time went backwards */ }
    });

    return () => { socket.off("price_update"); };
  }, [socket, mint]);

  // Compute current display price from last ohlcv candle
  const currentVal = ohlcv && ohlcv.length > 0
    ? ohlcv[ohlcv.length - 1].close * getMultiplier(solPrice)
    : null;

  const intervals: { label: string; value: Interval }[] = [
    { label: "1s", value: "1s" }, { label: "1m", value: "1m" },
    { label: "5m", value: "5m" }, { label: "15m", value: "15m" },
    { label: "30m", value: "30m" }, { label: "1h", value: "1h" },
    { label: "1d", value: "1d" },
  ];

  const ToolbarBtn = ({
    active, onClick, children,
  }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={clsx(
        "px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-[#00ff88]/12 text-[#00ff88] border border-[#00ff88]/30"
          : "text-white/40 hover:text-white/70 border border-transparent hover:border-white/10"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="glass-panel rounded-[28px] overflow-hidden">
      {/* Row 1: Value + ATH */}
      <div className="border-b border-white/8 px-3 pt-2.5 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white/40 text-xs shrink-0">
            {priceMode === "mcap" ? "Market Cap" : "Price"}
          </span>
          {currentVal !== null && (
            <span className="text-white text-sm font-bold font-mono truncate">
              {priceMode === "mcap"
                ? (currencyMode === "usd" ? fmtMcap(currentVal) : fmtMcapSol(currentVal))
                : (currencyMode === "usd"
                    ? `$${currentVal.toFixed(8)}`
                    : `${currentVal.toFixed(8)} SOL`)}
            </span>
          )}
        </div>
        {ath !== null && (
          <span className="text-[#555] text-[10px] font-mono shrink-0">
            ATH{" "}
            <span className="text-[#888]">
              {priceMode === "mcap"
                ? (currencyMode === "usd" ? fmtMcap(ath) : fmtMcapSol(ath))
                : (currencyMode === "usd" ? `$${ath.toFixed(8)}` : `${ath.toFixed(8)} SOL`)}
            </span>
          </span>
        )}
      </div>

      {/* Row 2: Timeframes + feature toggles — horizontally scrollable on mobile */}
      <div className="border-b border-white/8 px-3 py-1.5 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {/* Timeframes */}
          {intervals.map((i) => (
            <button
              key={i.value}
              onClick={() => setInterval(i.value)}
              className={clsx(
                "px-2.5 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap",
                interval === i.value
                  ? "bg-[#00ff88]/12 text-[#00ff88]"
                  : "text-white/35 hover:text-white/70"
              )}
            >
              {i.label}
            </button>
          ))}

          <div className="w-px h-4 bg-white/10 mx-1 shrink-0" />

          <ToolbarBtn active={showTrades} onClick={() => setShowTrades((v) => !v)}>
            Trade Display
          </ToolbarBtn>

          <ToolbarBtn active={!showBubbles} onClick={() => setShowBubbles((v) => !v)}>
            {showBubbles ? "Hide Bubbles" : "Show Bubbles"}
          </ToolbarBtn>

          <div className="w-px h-4 bg-white/10 mx-1 shrink-0" />

          {/* Price/MCap toggle */}
          <div className="flex rounded border border-white/10 overflow-hidden shrink-0">
            <button
              onClick={() => setPriceMode("price")}
              className={clsx(
                "px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                priceMode === "price" ? "bg-[#00ff88]/15 text-[#00ff88]" : "text-white/35 hover:text-white/60"
              )}
            >
              Price
            </button>
            <button
              onClick={() => setPriceMode("mcap")}
              className={clsx(
                "px-2.5 py-1 text-xs font-medium transition-colors border-l border-white/10 whitespace-nowrap",
                priceMode === "mcap" ? "bg-[#00ff88]/15 text-[#00ff88]" : "text-white/35 hover:text-white/60"
              )}
            >
              MCap
            </button>
          </div>

          {/* USD/SOL toggle */}
          <div className="flex rounded border border-white/10 overflow-hidden shrink-0">
            <button
              onClick={() => setCurrencyMode("usd")}
              className={clsx(
                "px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                currencyMode === "usd" ? "bg-[#00ff88]/15 text-[#00ff88]" : "text-white/35 hover:text-white/60"
              )}
            >
              USD
            </button>
            <button
              onClick={() => setCurrencyMode("sol")}
              className={clsx(
                "px-2.5 py-1 text-xs font-medium transition-colors border-l border-white/10 whitespace-nowrap",
                currencyMode === "sol" ? "bg-[#00ff88]/15 text-[#00ff88]" : "text-white/35 hover:text-white/60"
              )}
            >
              SOL
            </button>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative">
        {/* Live trade bubbles */}
        {showBubbles && flashTrades.length > 0 && (
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 pointer-events-none">
            {flashTrades.map((ft) => (
              <div
                key={ft.id}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-lg animate-slide-in",
                  ft.type === "BUY"
                    ? "bg-[#00ff88]/12 border-[#00ff88]/35 text-[#00ff88]"
                    : "bg-[#ff4444]/12 border-[#ff4444]/35 text-[#ff4444]"
                )}
              >
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: ft.type === "BUY" ? "rgba(0,255,136,0.2)" : "rgba(255,68,68,0.2)" }}>
                  {ft.type === "BUY" ? "▲" : "▼"}
                </span>
                <span className="font-mono">{ft.trader.slice(0, 4)}…{ft.trader.slice(-4)}</span>
                <span className="text-white font-mono">
                  {(Number(ft.solAmount) / 1e9).toFixed(3)} SOL
                </span>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#091210]/90 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/42">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading chart…</span>
            </div>
          </div>
        )}

        {!isLoading && (!ohlcv || ohlcv.length === 0) && (
          <div className="flex h-[480px] items-center justify-center text-white/25">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <div className="text-sm">No chart data yet</div>
              <div className="text-xs text-[#444] mt-1">Make the first trade!</div>
            </div>
          </div>
        )}

        <div ref={chartContainerRef} className="w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,rgba(7,17,15,0),rgba(7,17,15,0.85))]" />
      </div>
    </div>
  );
}
