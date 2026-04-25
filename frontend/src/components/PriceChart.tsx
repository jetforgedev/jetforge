"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { clsx } from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOHLCV, getTrades, getPortfolio } from "@/lib/api";
import { getTradeTag } from "@/components/TradesList";
import { useSocket } from "@/hooks/useLiveFeed";
import { useWallet } from "@solana/wallet-adapter-react";

type Interval = "1s" | "1m" | "5m" | "15m" | "30m" | "1h" | "1d";
type PriceMode = "mcap" | "price";
type CurrencyMode = "usd" | "sol";

interface PriceChartProps {
  mint: string;
  symbol: string;
  solPrice: number | null;
  creator?: string;
  floatingPanel?: React.ReactNode;
  /** Called with true on enter, false on exit — lets the parent page manage
   *  its own layout (e.g. hide the trading-panel column while chart is fullscreen). */
  onFullscreenChange?: (isFs: boolean) => void;
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

// Fix #2: dynamic price format precision based on value magnitude
function computePriceFormat(maxVal: number): { type: "price"; precision: number; minMove: number } {
  if (maxVal <= 0 || !isFinite(maxVal)) return { type: "price", precision: 8, minMove: 0.00000001 };
  if (maxVal < 0.0001)  return { type: "price", precision: 8, minMove: 0.00000001 };
  if (maxVal < 0.001)   return { type: "price", precision: 7, minMove: 0.0000001 };
  if (maxVal < 0.01)    return { type: "price", precision: 6, minMove: 0.000001 };
  if (maxVal < 0.1)     return { type: "price", precision: 5, minMove: 0.00001 };
  if (maxVal < 1)       return { type: "price", precision: 4, minMove: 0.0001 };
  if (maxVal < 1_000)   return { type: "price", precision: 2, minMove: 0.01 };
  return { type: "price", precision: 0, minMove: 1 };
}

interface OHLC { time: number; open: number; high: number; low: number; close: number; }

function toHeikinAshi(candles: OHLC[]): OHLC[] {
  const ha: OHLC[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0
      ? (c.open + c.close) / 2
      : (ha[i - 1].open + ha[i - 1].close) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    ha.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose });
  }
  return ha;
}

export function PriceChart({ mint, symbol, solPrice, creator, floatingPanel, onFullscreenChange }: PriceChartProps) {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);  // candlestick + HA
  const lineSeriesRef = useRef<any>(null);
  const areaSeriesRef = useRef<any>(null);
  const barSeriesRef = useRef<any>(null);
  const activeSeriesRef = useRef<any>(null);  // always points to visible series
  const volumeSeriesRef = useRef<any>(null);
  // Tracks the entry price line so it can be removed/moved when the series switches
  const entryPriceLineRef = useRef<{ line: any; series: any } | null>(null);
  const liveCandle = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);
  // Last HA candle in display units — needed to compute live HA updates correctly (P1-1)
  const lastHaCandle = useRef<OHLC | null>(null);
  // Track whether OHLCV has been loaded for the first time so subsequent
  // refreshes (triggered by new trades) don't call fitContent() and reset the
  // user's zoom / scroll position.
  const ohlcvFirstLoad = useRef(true);

  // Fix #8: rename setter to avoid shadowing window.setInterval
  const [interval, setChartInterval] = useState<Interval>("1m");
  const [priceMode, setPriceMode] = useState<PriceMode>("mcap");
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>("usd");
  const [showTrades, setShowTrades] = useState(true);
  const [showBubbles, setShowBubbles] = useState(true);
  const [crosshairMode, setCrosshairMode] = useState<"normal" | "magnet">("normal");

  // Fullscreen + draggable panel state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsChartH, setFsChartH] = useState<number | null>(null); // explicit px height in fullscreen
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);   // flex-1 div that fills remaining height
  const chartOverlayRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  /** true during the ~200 ms window after exit while layout re-settles.
   *  Prevents the ResizeObserver from locking in fullscreen-sized dimensions. */
  const fsExitRef = useRef(false);
  type ChartType = "heikinashi" | "candles" | "line" | "area" | "bars";
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [showChartDropdown, setShowChartDropdown] = useState(false);
  const [dropdownAnchor, setDropdownAnchor] = useState<{ top: number; left: number } | null>(null);
  const chartTypeRef = useRef<ChartType>("candles");

  // ATH stored in raw backend units (pre-multiplier) so it survives USD↔SOL / MCap↔Price toggles (P1-2)
  const [athRaw, setAthRaw] = useState<number | null>(null);

  // Fix #7: live close price state for fresh header display
  const [liveClose, setLiveClose] = useState<number | null>(null);
  // Y pixel of the entry price line within the chart canvas — drives the on-chart PnL tag
  const [entryLineY, setEntryLineY] = useState<number | null>(null);

  // Tracks whether the chart + all series refs are ready.
  // Data-loading effects depend on this so they re-run after async chart init.
  const [chartReady, setChartReady] = useState(false);

  const socket = useSocket();

  const { data: ohlcv, isLoading } = useQuery({
    queryKey: ["ohlcv", mint, interval],
    queryFn: () => getOHLCV(mint, interval, 200),
    staleTime: 10_000,
    // Periodic resync keeps all open browser tabs consistent.
    // Without this, each browser seeds liveCandle from whatever OHLCV state it
    // loaded at page-open time and never refreshes — causing charts to diverge
    // as price_update events extend each browser's independent liveCandle ref.
    // Every 10 s all browsers reload from the same DB source, reseed liveCandle
    // to the same value, and converge.  The ohlcvFirstLoad guard means this
    // won't reset the user's zoom/scroll position.
    refetchInterval: 10_000,
  });

  const { data: tradesData } = useQuery({
    queryKey: ["trades-markers", mint],
    queryFn: () => getTrades(mint, 1, 500),
    staleTime: 60_000,
    enabled: showTrades,
  });

  // Portfolio query — shares cache key with TradingPanel so only one request is made.
  // Filtered to this mint to keep payload tiny (backend filters server-side).
  const walletStr = publicKey?.toString();
  const { data: tokenPortfolio } = useQuery({
    queryKey: ["portfolio-token", mint, walletStr],
    queryFn: () => getPortfolio(walletStr!, mint),
    enabled: !!walletStr,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
  const entryHolding = tokenPortfolio?.holdings?.find((h) => h.mint === mint);
  // Only show entry overlay when there is an open position (tokenBalance > 0)
  const avgBuyPriceSol = (entryHolding && entryHolding.tokenBalance > 0) ? entryHolding.avgBuyPriceSol : null;
  const entryTokenBalance = entryHolding?.tokenBalance ?? 0;

  // Compute display multiplier based on mode.
  // ohlcv price values are in "SOL per token × 1e6" units (mcap-scale).
  // Original working formula for MCap USD was: solPrice * 1_000_000
  const getMultiplier = useCallback((sp: number | null) => {
    const solUsd = sp ?? 0;
    if (priceMode === "mcap") {
      return currencyMode === "usd" ? solUsd * 1_000_000 : 1_000_000;
    } else {
      // Per-token price: mcap_value / total_supply (1B) = value / 1000
      return currencyMode === "usd" ? solUsd * 1_000 : 1_000;
    }
  }, [priceMode, currencyMode]);

  // Converts avgBuyPriceSol → Y pixel within the chart canvas using the active series.
  // Returns null when the price is off-screen or no position exists.
  const computeEntryLineYRef = useRef<() => number | null>(() => null);
  const computeEntryLineY = useCallback((): number | null => {
    if (!activeSeriesRef.current || !avgBuyPriceSol || entryTokenBalance <= 0) return null;
    const mult = getMultiplier(solPrice);
    if (!mult) return null;
    const entryDisplayPrice = avgBuyPriceSol * 1000 * mult;
    const y = activeSeriesRef.current.priceToCoordinate(entryDisplayPrice);
    return typeof y === "number" && isFinite(y) && y >= 0 ? y : null;
  }, [avgBuyPriceSol, entryTokenBalance, solPrice, getMultiplier]);
  // Keep ref current so the stable chart-event handler always calls the latest version
  useEffect(() => { computeEntryLineYRef.current = computeEntryLineY; }, [computeEntryLineY]);

  // Reset live state when any display mode changes so stale units don't bleed in (P1-3)
  useEffect(() => {
    liveCandle.current = null;
    lastHaCandle.current = null;
    setLiveClose(null);
  }, [interval, priceMode, currencyMode]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const state: { chart: any; observer: ResizeObserver | null; destroyed: boolean } = {
      chart: null, observer: null, destroyed: false,
    };

    import("lightweight-charts").then(({ createChart, CrosshairMode }) => {
      if (state.destroyed || !chartContainerRef.current) return;

      // rAF ensures the browser has painted the container so dimensions are non-zero
      requestAnimationFrame(() => {
        if (state.destroyed || !chartContainerRef.current) return;

        const containerW = chartContainerRef.current.offsetWidth || 600;
        const containerH = chartContainerRef.current.offsetHeight || 480;

        const chart = createChart(chartContainerRef.current, {
        layout: { background: { color: "#0d0d0d" }, textColor: "#555" },
        grid: { vertLines: { color: "#111" }, horzLines: { color: "#111" } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: "#1a1a1a",
          textColor: "#555",
          scaleMargins: { top: 0.1, bottom: 0.15 },
        },
        timeScale: {
          borderColor: "#1a1a1a",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 5,
          barSpacing: 4,
          minBarSpacing: 1,
        },
        width: containerW,
        height: containerH,
      });

      // Fix #2: use computePriceFormat(0) for initial series creation
      const candleSeries = chart.addCandlestickSeries({
        upColor: "#00ff88",
        downColor: "#ff4444",
        borderUpColor: "#00ff88",
        borderDownColor: "#ff4444",
        wickUpColor: "#00ff8880",
        wickDownColor: "#ff444480",
        priceFormat: computePriceFormat(0),
      });

      const lineSeries = chart.addLineSeries({
        color: "#00ff88", lineWidth: 2, visible: false,
        priceFormat: computePriceFormat(0),
      });

      const areaSeries = chart.addAreaSeries({
        lineColor: "#00ff88", topColor: "#00ff8820", bottomColor: "#00ff8800",
        lineWidth: 2, visible: false,
        priceFormat: computePriceFormat(0),
      });

      const barSeries = chart.addBarSeries({
        upColor: "#00ff88", downColor: "#ff4444", visible: false,
        priceFormat: computePriceFormat(0),
      });

      const volumeSeries = chart.addHistogramSeries({
        color: "#1a1a1a",
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      const isMobile = window.innerWidth < 1024;
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: isMobile ? 0.92 : 0.85, bottom: 0 },
      });

        state.chart = chart;
        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        lineSeriesRef.current = lineSeries;
        areaSeriesRef.current = areaSeries;
        barSeriesRef.current = barSeries;
        activeSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;

        const resizeObserver = new ResizeObserver(() => {
          // Skip during the post-exit settling window — we apply correct
          // dimensions ourselves via setTimeout after layout has stabilised.
          if (fsExitRef.current) return;
          if (chartContainerRef.current) {
            chart.applyOptions({
              width: chartContainerRef.current.offsetWidth || containerW,
              height: chartContainerRef.current.offsetHeight || containerH,
            });
          }
        });
        resizeObserver.observe(chartContainerRef.current);
        state.observer = resizeObserver;

        // Signal data-loading effects that chart is ready.
        // Without this, ohlcv effects that ran before rAF completed would have
        // found null series refs and bailed — data would never appear.
        setChartReady(true);

      }); // end requestAnimationFrame
    }); // end import()

    return () => {
      state.destroyed = true;
      state.observer?.disconnect();
      state.chart?.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
      areaSeriesRef.current = null;
      barSeriesRef.current = null;
      activeSeriesRef.current = null;
      volumeSeriesRef.current = null;
      liveCandle.current = null;
      entryPriceLineRef.current = null;
      setChartReady(false);
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

  // Sync chartType to ref + switch visible series
  useEffect(() => {
    chartTypeRef.current = chartType;
    if (!candleSeriesRef.current) return;

    candleSeriesRef.current.applyOptions({ visible: chartType === "candles" || chartType === "heikinashi" });
    lineSeriesRef.current?.applyOptions({ visible: chartType === "line" });
    areaSeriesRef.current?.applyOptions({ visible: chartType === "area" });
    barSeriesRef.current?.applyOptions({ visible: chartType === "bars" });

    if (chartType === "line") activeSeriesRef.current = lineSeriesRef.current;
    else if (chartType === "area") activeSeriesRef.current = areaSeriesRef.current;
    else if (chartType === "bars") activeSeriesRef.current = barSeriesRef.current;
    else activeSeriesRef.current = candleSeriesRef.current;
  }, [chartType]);

  // Reset first-load flag when the user changes interval or chart type so
  // fitContent() fires again for the new data set.
  useEffect(() => { ohlcvFirstLoad.current = true; }, [interval, chartType]);

  // Current display price — prefer live close, fall back to last OHLCV candle.
  // Declared here (before Effects 1 & 2) so it is available in Effect 2's deps array.
  const currentVal = liveClose
    ?? (ohlcv && ohlcv.length > 0 ? ohlcv[ohlcv.length - 1].close * getMultiplier(solPrice) : null);

  // ATH in display units — derived at render time from raw so it's always in current mode (P1-2)
  const athDisplay = athRaw !== null ? athRaw * getMultiplier(solPrice) : null;

  // ── Entry price line (Effect 1): create / destroy ────────────────────────────
  // Runs when position data, chart type, or display mode changes.
  // Removes the old line from the previous series before creating a new one —
  // this handles the series-switch that happens on chartType changes.
  useEffect(() => {
    // Always clean up first
    if (entryPriceLineRef.current) {
      try {
        entryPriceLineRef.current.series.removePriceLine(entryPriceLineRef.current.line);
      } catch { /* series may already be gone */ }
      entryPriceLineRef.current = null;
    }

    if (!chartReady || !activeSeriesRef.current || !avgBuyPriceSol || entryTokenBalance <= 0) return;

    const mult = getMultiplier(solPrice);
    if (!mult) return;
    // Convert SOL-per-display-token to chart display units:
    //   rawOhlcvPrice = priceSOL × 1000 (OHLCV is in "mcap-scale" units)
    //   displayPrice  = rawOhlcvPrice × mult
    const entryDisplayPrice = avgBuyPriceSol * 1000 * mult;

    const line = activeSeriesRef.current.createPriceLine({
      price: entryDisplayPrice,
      color: "#888888", // neutral — Effect 2 sets the correct color immediately after
      lineWidth: 1,
      lineStyle: 1,     // 1 = dashed
      axisLabelVisible: true,
      title: "Avg Entry",
    });

    entryPriceLineRef.current = { line, series: activeSeriesRef.current };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, chartType, priceMode, currencyMode, avgBuyPriceSol, entryTokenBalance, solPrice, getMultiplier]);

  // ── Entry price line (Effect 2): color-only update ───────────────────────────
  // Cheap applyOptions call — avoids recreating the line on every price tick.
  // chartType is included so this fires right after Effect 1 recreates the line.
  useEffect(() => {
    if (!entryPriceLineRef.current || !avgBuyPriceSol || currentVal === null) return;
    const mult = getMultiplier(solPrice);
    if (!mult) return;
    const entryDisplayPrice = avgBuyPriceSol * 1000 * mult;
    const color =
      currentVal > entryDisplayPrice * 1.001 ? "#00ff88" :
      currentVal < entryDisplayPrice * 0.999 ? "#ff4444" :
      "#888888";
    try {
      entryPriceLineRef.current.line.applyOptions({ color });
    } catch { /* line was just removed */ }
  }, [currentVal, avgBuyPriceSol, solPrice, getMultiplier, chartType]);

  // ── On-chart PnL tag: subscribe to chart events that move the price scale ────
  // Uses a stable `update` closure (via ref) so we never need to resubscribe on
  // every solPrice tick — only when chartReady toggles.
  useEffect(() => {
    if (!chartReady || !chartRef.current) return;
    const update = () => setEntryLineY(computeEntryLineYRef.current());
    update(); // initial placement
    chartRef.current.timeScale().subscribeVisibleTimeRangeChange(update);
    chartRef.current.subscribeCrosshairMove(update);
    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleTimeRangeChange(update);
      chartRef.current?.unsubscribeCrosshairMove(update);
    };
  }, [chartReady]);

  // Recompute Y whenever position data, display mode, or live price changes.
  // chartType included so the Y is refreshed after the series-switch (Effect 1).
  useEffect(() => {
    setEntryLineY(computeEntryLineY());
  }, [computeEntryLineY, currentVal, chartType]);

  // Load OHLCV data — depends on chartReady so it re-fires after async chart init
  useEffect(() => {
    if (!chartReady || !candleSeriesRef.current || !ohlcv || ohlcv.length === 0) return;

    // If solPrice hasn't loaded yet, mult=0 in USD mode which maps every candle
    // to 0 and corrupts the y-axis. Fall back to SOL-based units so the chart
    // is never blank. The effect re-runs when solPrice arrives (it's in deps),
    // at which point the correct USD scale is applied.
    const mult = getMultiplier(solPrice) || (priceMode === "mcap" ? 1_000_000 : 1_000);

    const candles = ohlcv.map((d) => ({
      time: d.time as any,
      open:  d.open  * mult,
      high:  d.high  * mult,
      low:   d.low   * mult,
      close: d.close * mult,
    }));

    const displayCandles = chartType === "heikinashi" ? toHeikinAshi(candles) : candles;

    const volumes = ohlcv.map((d, i) => ({
      time: d.time as any,
      value: d.volume,
      color: (displayCandles[i]?.close ?? d.close) >= (displayCandles[i]?.open ?? d.open) ? "#00ff8830" : "#ff444430",
    }));
    const lineData = candles.map((c) => ({ time: c.time as any, value: c.close }));

    // Dynamic price format based on display-unit magnitude
    const maxHigh = Math.max(...candles.map((c) => c.high));
    const fmt = computePriceFormat(maxHigh);
    candleSeriesRef.current?.applyOptions({ priceFormat: fmt });
    lineSeriesRef.current?.applyOptions({ priceFormat: fmt });
    areaSeriesRef.current?.applyOptions({ priceFormat: fmt });
    barSeriesRef.current?.applyOptions({ priceFormat: fmt });

    candleSeriesRef.current.setData(displayCandles);
    lineSeriesRef.current?.setData(lineData);
    areaSeriesRef.current?.setData(lineData);
    barSeriesRef.current?.setData(candles);
    volumeSeriesRef.current?.setData(volumes);
    // Time-axis positioning:
    // setVisibleLogicalRange counts EVERY empty time slot between sparse candles
    // as a logical position, so a token with an 8-hour overnight gap between its
    // first candle and the next cluster has ~480 virtual empty slots — making all
    // but the very first candle invisible in a small logical range.
    //
    // fitContent() always fits the full data range correctly regardless of gaps.
    // For ≤10 candles we lock in a readable barSpacing first so 1-5 candles
    // don't stretch to 200px wide; for anything larger fitContent handles it.
    const ts = chartRef.current?.timeScale();
    if (ts && ohlcvFirstLoad.current) {
      // Only fit-to-content on the first data load (or after the user changes
      // interval / chart type).  Subsequent refreshes triggered by new trades
      // leave the viewport alone so the user's scroll position is preserved.
      if (displayCandles.length <= 10) {
        chartRef.current?.applyOptions({
          timeScale: { rightOffset: 8, barSpacing: 12 },
        });
      }
      ts.fitContent();
      ohlcvFirstLoad.current = false;
    }

    // ATH: store raw backend value (pre-multiplier) so toggles don't corrupt it (P1-2)
    const maxHighRaw = Math.max(...ohlcv.map((d) => d.high));
    setAthRaw(maxHighRaw);

    if (candles.length > 0) {
      // Seed liveCandle from RAW candles (not HA display candles) so live trade
      // updates accumulate correctly regardless of chart type.
      const lastRaw = candles[candles.length - 1];
      liveCandle.current = {
        time: lastRaw.time as number,
        open: lastRaw.open, high: lastRaw.high, low: lastRaw.low, close: lastRaw.close,
      };
      // Seed lastHaCandle from HA displayCandles so the live HA update has a
      // valid previous HA candle to build the next one from.
      if (chartType === "heikinashi" && displayCandles.length > 0) {
        lastHaCandle.current = displayCandles[displayCandles.length - 1] as OHLC;
      }
    }
  }, [ohlcv, solPrice, priceMode, currencyMode, getMultiplier, chartType, chartReady]);

  // Trade markers
  useEffect(() => {
    const series = activeSeriesRef.current ?? candleSeriesRef.current;
    if (!series) return;

    if (!showTrades && !showBubbles) {
      series.setMarkers([]);
      return;
    }

    if (!tradesData?.trades?.length) {
      series.setMarkers([]);
      return;
    }

    const myAddress = publicKey?.toBase58();

    const markers = tradesData.trades
      .filter((t) => {
        const isDevTrade = t.trader === creator;
        const isMyTrade = myAddress && t.trader === myAddress;
        // Dev trades: controlled by "Hide Bubbles" toggle
        if (isDevTrade) return showBubbles;
        // My trades: controlled by "Trade Display" toggle
        if (isMyTrade) return showTrades;
        return false;
      })
      .map((t) => ({
        time: Math.floor(new Date(t.timestamp).getTime() / 1000) as any,
        position: t.type === "BUY" ? ("belowBar" as const) : ("aboveBar" as const),
        color: t.trader === creator
          ? (t.type === "BUY" ? "#ffaa00" : "#ff6600")   // dev = orange
          : (t.type === "BUY" ? "#00ff88" : "#ff4444"),  // mine = green/red
        shape: "circle" as const,
        text: "",   // no text labels — dots only, info available via crosshair
        size: t.trader === creator ? 0.8 : 0.6,
      }))
      .sort((a, b) => a.time - b.time);

    series.setMarkers(markers);
  }, [tradesData, creator, ohlcv, showTrades, showBubbles, publicKey, chartType]);

  // Ensure PriceChart is subscribed to the token room independently of sibling
  // hooks (useTokenData, useTrades). Re-subscribes on every reconnect so
  // price_update events keep arriving after network interruptions.
  // No unsubscribe:token on cleanup — the room is shared; leaving would break
  // sibling listeners. Socket.IO join is idempotent.
  useEffect(() => {
    if (!socket || !mint) return;
    socket.emit("subscribe:token", mint);
    const onReconnect = () => socket.emit("subscribe:token", mint);
    socket.on("connect", onReconnect);
    return () => { socket.off("connect", onReconnect); };
  }, [socket, mint]);

  // Live trade flash bubble
  const [flashTrades, setFlashTrades] = useState<Array<{
    id: number; type: "BUY" | "SELL"; trader: string; solAmount: string;
  }>>([]);
  const flashIdRef = useRef(0);

  useEffect(() => {
    if (!socket || !mint) return;

    // Named handler so .off() removes only this component's listener (P1-4)
    const onNewTrade = (trade: any) => {
      if (trade.mint !== mint) return;
      const id = ++flashIdRef.current;
      setFlashTrades((prev) => [...prev.slice(-4), { id, type: trade.type, trader: trade.trader, solAmount: trade.solAmount }]);
      setTimeout(() => {
        setFlashTrades((prev) => prev.filter((f) => f.id !== id));
      }, 5000);
      queryClient.invalidateQueries({ queryKey: ["trades-markers", mint] });
      // OHLCV is intentionally NOT invalidated here. Invalidating on every
      // new_trade caused the chart to redraw from DB data on any user's trade,
      // making the candle appear to fire before the user's own transaction
      // confirmed. The live candle is maintained in real-time by the
      // price_update socket handler instead, which is accurate and instant.
    };

    socket.on("new_trade", onNewTrade);
    return () => { socket.off("new_trade", onNewTrade); };
  }, [socket, mint, queryClient]);

  const intervalRef = useRef(interval);
  const solPriceRef = useRef(solPrice);
  const getMult = useRef(getMultiplier);
  useEffect(() => { intervalRef.current = interval; }, [interval]);
  useEffect(() => { solPriceRef.current = solPrice; }, [solPrice]);
  useEffect(() => { getMult.current = getMultiplier; }, [getMultiplier]);

  // Real-time candle updates
  useEffect(() => {
    if (!socket || !mint) return;

    // Named handler so .off() removes only this component's listener (P1-4)
    const onPriceUpdate = (data: any) => {
      if (data.mint !== mint) return;
      if (!candleSeriesRef.current) return;

      const ms = INTERVAL_MS[intervalRef.current] ?? 60_000;
      // If solPrice hasn't loaded yet, getMult returns 0 in USD mode.
      // Fall back to getMult(1) which gives the correct MCap vs Price scale
      // factor (1_000_000 or 1_000) without depending on the actual SOL price.
      // This keeps the live candle in the same units as the OHLCV fallback so
      // the scale stays consistent until solPrice arrives.
      const rawMult = getMult.current(solPriceRef.current);
      const mult = rawMult || getMult.current(1);
      const candleTime = (Math.floor((data.timestamp * 1000) / ms) * ms) / 1000;
      const val = data.price * mult;

      // Live close for header display
      setLiveClose(val);

      // ATH: raw price (pre-multiplier) survives mode toggles (P1-2)
      setAthRaw((prev) => prev === null ? data.price : Math.max(prev, data.price));

      // Build / extend the raw live candle (P1-3: liveCandle is in display units,
      // reset on mode change so units always match)
      const prev = liveCandle.current;
      let updated: typeof prev;
      if (prev && prev.time === candleTime) {
        // Same bucket — extend the existing candle
        updated = { time: candleTime, open: prev.open, high: Math.max(prev.high, val), low: Math.min(prev.low, val), close: val };
      } else {
        // New bucket — open at the previous candle's close so the candle has a
        // visible body, matching the backend OHLCV "prevClose-as-open" convention.
        // Falls back to val (launch or first-ever live candle) when prev is null.
        const open = prev ? prev.close : val;
        updated = { time: candleTime, open, high: Math.max(open, val), low: Math.min(open, val), close: val };
      }
      liveCandle.current = updated;

      const ct = chartTypeRef.current;
      try {
        if (ct === "candles") {
          candleSeriesRef.current?.update({ time: updated.time as any, open: updated.open, high: updated.high, low: updated.low, close: updated.close });
        } else if (ct === "heikinashi") {
          // Transform live raw candle to HA using previous HA candle (P1-1)
          const prevHa = lastHaCandle.current;
          const haClose = (updated.open + updated.high + updated.low + updated.close) / 4;
          const haOpen  = prevHa ? (prevHa.open + prevHa.close) / 2 : (updated.open + updated.close) / 2;
          const haHigh  = Math.max(updated.high, haOpen, haClose);
          const haLow   = Math.min(updated.low,  haOpen, haClose);
          const haUpdated: OHLC = { time: updated.time, open: haOpen, high: haHigh, low: haLow, close: haClose };
          lastHaCandle.current = haUpdated;
          candleSeriesRef.current?.update({ time: haUpdated.time as any, open: haUpdated.open, high: haUpdated.high, low: haUpdated.low, close: haUpdated.close });
        } else if (ct === "line") {
          lineSeriesRef.current?.update({ time: updated.time as any, value: updated.close });
        } else if (ct === "area") {
          areaSeriesRef.current?.update({ time: updated.time as any, value: updated.close });
        } else if (ct === "bars") {
          barSeriesRef.current?.update({ time: updated.time as any, open: updated.open, high: updated.high, low: updated.low, close: updated.close });
        }
        // No scrollToRealTime() — lightweight-charts extends the right edge automatically
        // when the latest bar is visible; forcing it every tick breaks scrolling to history
      } catch { /* time went backwards — ignore */ }
    };

    socket.on("price_update", onPriceUpdate);
    return () => { socket.off("price_update", onPriceUpdate); };
  }, [socket, mint]);

  // Close chart type dropdown on outside click or scroll (anchor drifts on scroll)
  useEffect(() => {
    if (!showChartDropdown) return;
    const close = (e: Event) => {
      if (e instanceof MouseEvent) {
        const target = e.target as Element;
        if (!target.closest('[data-dropdown="charttype"]')) setShowChartDropdown(false);
      } else {
        // scroll event — always close so anchor stays accurate
        setShowChartDropdown(false);
      }
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true); // capture phase catches nested scrollers
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [showChartDropdown]);

  // ── CSS-based fullscreen ─────────────────────────────────────────────────────
  // Uses className toggle (fixed inset-0 z-[9999]) instead of the browser's
  // Fullscreen API so the DOM tree is never moved and the canvas bitmap survives.
  //
  // Exit sequence:
  //  1. fsExitRef=true  → ResizeObserver silenced (can't lock in fullscreen dims)
  //  2. React state cleared → className reverts, fsChartH→null, inline height gone
  //  3. setTimeout(200ms) → layout has fully settled → remeasure → chart.applyOptions
  //  4. fsExitRef=false → ResizeObserver re-enabled for future resizes
  //  5. onFullscreenChange(false) → parent page restores its own layout (trading panel)
  const wasFullscreen = useRef(false);

  const handleFullscreenToggle = useCallback(() => {
    // Fullscreen is desktop-only — skip on narrow viewports
    if (!isFullscreen && window.innerWidth < 640) return;

    if (isFullscreen) {
      // ── EXIT ──────────────────────────────────────────────────────────────
      // Silence ResizeObserver FIRST so it can't snapshot fullscreen dimensions
      fsExitRef.current = true;

      setFsChartH(null);
      setIsFullscreen(false);
      setPanelPos(null);
      isDragging.current = false;
      onFullscreenChange?.(false);

      // 200 ms: enough for React render + CSS grid re-layout + browser paint.
      // Then remeasure the restored container and resize the chart correctly.
      const tid = setTimeout(() => {
        fsExitRef.current = false;
        if (chartContainerRef.current && chartRef.current) {
          const w = chartContainerRef.current.clientWidth;
          const h = chartContainerRef.current.clientHeight;
          if (w > 0 && h > 0) {
            chartRef.current.applyOptions({ width: w, height: h });
            chartRef.current.timeScale().fitContent();
          }
        }
      }, 200);
      // Clean up timer if component unmounts before it fires
      return () => clearTimeout(tid);
    } else {
      // ── ENTER ─────────────────────────────────────────────────────────────
      setIsFullscreen(true);
      onFullscreenChange?.(true);

      // Measure chartAreaRef (the flex-1 div) after layout settles — this gives
      // the exact remaining height below the two toolbar rows, regardless of
      // how tall those rows happen to be.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const area = chartAreaRef.current;
          const overlay = chartOverlayRef.current;
          if (area) {
            const h = area.clientHeight;
            // Width = overlay width (area minus left toolbar); fall back to area width
            const w = overlay ? overlay.clientWidth : area.clientWidth;
            setFsChartH(h);
            if (chartRef.current) {
              chartRef.current.applyOptions({ width: w, height: h });
              chartRef.current.timeScale().fitContent();
            }
          }

          // Position trade panel bottom-right of the overlay
          if (panelRef.current && overlay) {
            const pw  = panelRef.current.offsetWidth  || 300;
            const ph  = panelRef.current.offsetHeight || 480;
            setPanelPos({ x: overlay.clientWidth - pw - 16, y: overlay.clientHeight - ph - 16 });
          } else {
            setPanelPos({ x: window.innerWidth - 316, y: window.innerHeight - 500 });
          }
        });
      });
    }
  }, [isFullscreen, onFullscreenChange]);

  // ESC key exits our CSS fullscreen (browser never owns it, so no native handler)
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleFullscreenToggle(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFullscreen, handleFullscreenToggle]);

  // Belt-and-suspenders: also fires the resize via wasFullscreen+double-rAF path
  // so the chart is corrected both immediately (rAF) and after settling (setTimeout).
  useEffect(() => {
    if (isFullscreen) { wasFullscreen.current = true; return; }
    if (!wasFullscreen.current) return;
    wasFullscreen.current = false;

    let id1: number, id2: number;
    id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        if (fsExitRef.current) return; // still settling — defer to setTimeout path
        if (chartContainerRef.current && chartRef.current) {
          const w = chartContainerRef.current.clientWidth;
          const h = chartContainerRef.current.clientHeight;
          if (w > 0 && h > 0) {
            chartRef.current.applyOptions({ width: w, height: h });
            chartRef.current.timeScale().fitContent();
          }
        }
      });
    });
    return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2); };
  }, [isFullscreen]);

  // Mouse drag — active only in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !panelRef.current || !chartOverlayRef.current) return;
      const ctr = chartOverlayRef.current.getBoundingClientRect();
      const pw = panelRef.current.offsetWidth;
      const ph = panelRef.current.offsetHeight;
      const x = Math.max(0, Math.min(e.clientX - ctr.left - dragOffset.current.x, ctr.width  - pw));
      const y = Math.max(0, Math.min(e.clientY - ctr.top  - dragOffset.current.y, ctr.height - ph));
      setPanelPos({ x, y });
    };
    const onMouseUp = () => { isDragging.current = false; };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
    };
  }, [isFullscreen]);

  // Touch drag
  useEffect(() => {
    if (!isFullscreen) return;

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || !panelRef.current || !chartOverlayRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const ctr = chartOverlayRef.current.getBoundingClientRect();
      const pw = panelRef.current.offsetWidth;
      const ph = panelRef.current.offsetHeight;
      const x = Math.max(0, Math.min(touch.clientX - ctr.left - dragOffset.current.x, ctr.width  - pw));
      const y = Math.max(0, Math.min(touch.clientY - ctr.top  - dragOffset.current.y, ctr.height - ph));
      setPanelPos({ x, y });
    };
    const onTouchEnd = () => { isDragging.current = false; };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend",  onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  onTouchEnd);
    };
  }, [isFullscreen]);

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
        "px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-[#00ff88]/12 text-[#00ff88] border border-[#00ff88]/30"
          : "text-white/40 hover:text-white/70 border border-transparent hover:border-white/10"
      )}
    >
      {children}
    </button>
  );

  // ── Entry PnL badge — computed at render time from live currentVal ───────────
  const entryPnlBadge = (() => {
    if (!avgBuyPriceSol || entryTokenBalance <= 0 || currentVal === null) return null;
    const mult = getMultiplier(solPrice);
    if (!mult) return null;
    // Reverse the display-unit conversion to get live SOL-per-display-token price
    const liveSpotSOL = currentVal / (1000 * mult);
    const livePnlSol = entryTokenBalance * (liveSpotSOL - avgBuyPriceSol);
    const livePnlPct = ((liveSpotSOL - avgBuyPriceSol) / avgBuyPriceSol) * 100;
    const livePnlUsd = solPrice ? livePnlSol * solPrice : null;
    const isProfit = livePnlSol > 0.0001;
    const isLoss   = livePnlSol < -0.0001;
    const sign   = isProfit ? "+" : "";
    const pctStr = `${sign}${livePnlPct.toFixed(1)}%`;
    const usdStr = livePnlUsd !== null
      ? (livePnlUsd >= 0 ? `+$${livePnlUsd.toFixed(2)}` : `-$${Math.abs(livePnlUsd).toFixed(2)}`)
      : null;
    // solStr: always carries sign — negative numbers get "-" from toFixed itself
    const solStr = `${sign}${livePnlSol.toFixed(4)} SOL`;
    return { pctStr, usdStr, solStr, isProfit, isLoss };
  })();

  const chartEl = (
    <div
      ref={chartWrapperRef}
      className={clsx(
        isFullscreen
          ? "fixed inset-0 z-[9999] flex flex-col bg-[#0d0d0d] overflow-hidden"
          : "glass-panel rounded-[28px] overflow-hidden"
      )}
    >
      {/* Row 1: Value + ATH + fullscreen toggle */}
      <div className="border-b border-white/8 px-3 pt-2.5 pb-2 flex items-center justify-between gap-2 shrink-0">
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
        <div className="flex items-center gap-2 shrink-0">
          {athDisplay !== null && (
            <span className="text-[#555] text-[10px] font-mono hidden sm:inline">
              ATH{" "}
              <span className="text-[#888]">
                {priceMode === "mcap"
                  ? (currencyMode === "usd" ? fmtMcap(athDisplay) : fmtMcapSol(athDisplay))
                  : (currencyMode === "usd" ? `$${athDisplay.toFixed(8)}` : `${athDisplay.toFixed(8)} SOL`)}
              </span>
            </span>
          )}
          {/* Entry PnL badge — visually distinct pill tied to wallet position */}
          {entryPnlBadge && (
            <div className={clsx(
              "flex items-center gap-1 rounded-md border px-2 py-0.5 shrink-0",
              entryPnlBadge.isProfit
                ? "bg-[#00ff88]/8 border-[#00ff88]/25"
                : entryPnlBadge.isLoss
                ? "bg-[#ff4444]/8 border-[#ff4444]/25"
                : "bg-white/[0.04] border-white/10"
            )}>
              {/* "PnL" label — makes it unmistakably about the user's position */}
              <span className={clsx(
                "text-[9px] font-bold uppercase tracking-widest",
                entryPnlBadge.isProfit ? "text-[#00ff88]/60"
                : entryPnlBadge.isLoss ? "text-[#ff4444]/60"
                : "text-[#555]"
              )}>PnL</span>
              {/* Primary value: USD if available, else SOL */}
              <span className={clsx(
                "text-[11px] font-mono font-bold",
                entryPnlBadge.isProfit ? "text-[#00ff88]"
                : entryPnlBadge.isLoss ? "text-[#ff4444]"
                : "text-[#888]"
              )}>
                {entryPnlBadge.usdStr ?? entryPnlBadge.solStr}
              </span>
              {/* Secondary: SOL + % on desktop; % alone if no USD */}
              <span className={clsx(
                "text-[10px] font-mono hidden sm:inline",
                entryPnlBadge.isProfit ? "text-[#00ff88]/50"
                : entryPnlBadge.isLoss ? "text-[#ff4444]/50"
                : "text-[#555]"
              )}>
                {entryPnlBadge.usdStr
                  ? `${entryPnlBadge.solStr} (${entryPnlBadge.pctStr})`
                  : `(${entryPnlBadge.pctStr})`}
              </span>
            </div>
          )}
          {/* Fullscreen toggle — desktop only (hidden on mobile) */}
          <button
            onClick={handleFullscreenToggle}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen chart"}
            className="hidden sm:flex w-7 h-7 items-center justify-center rounded text-white/35 hover:text-white hover:bg-white/8 transition-colors"
          >
            {isFullscreen ? (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M5 1v4H1M9 1v4h4M5 13v-4H1M9 13v-4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Row 2: Timeframes + feature toggles — horizontally scrollable on mobile */}
      <div className="border-b border-white/8 px-3 py-1.5 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1 min-w-max">
          {/* Timeframes */}
          {intervals.map((i) => (
            <button
              key={i.value}
              onClick={() => setChartInterval(i.value)}
              className={clsx(
                "px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs rounded font-medium transition-colors whitespace-nowrap",
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
            <span className="sm:hidden">My Trades</span>
            <span className="hidden sm:inline">Trade Display</span>
          </ToolbarBtn>

          <ToolbarBtn active={!showBubbles} onClick={() => setShowBubbles((v) => !v)}>
            <span className="sm:hidden">{showBubbles ? "Dev ✕" : "Dev ✓"}</span>
            <span className="hidden sm:inline">{showBubbles ? "Hide Bubbles" : "Show Bubbles"}</span>
          </ToolbarBtn>

          {/* Chart type dropdown — rendered via fixed positioning so it escapes overflow-x-auto clipping */}
          <div className="relative shrink-0" data-dropdown="charttype">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setDropdownAnchor({ top: rect.bottom + 4, left: rect.left });
                setShowChartDropdown((v) => !v);
              }}
              className={clsx(
                "flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap",
                showChartDropdown
                  ? "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]"
                  : "border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
              )}
            >
              {chartType === "heikinashi" ? "Heikin Ashi"
                : chartType === "candles" ? "Candles"
                : chartType === "line" ? "Line"
                : chartType === "area" ? "Area"
                : "Bars"}
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={clsx("transition-transform", showChartDropdown && "rotate-180")}>
                <path d="M1 2l3 3 3-3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="w-px h-4 bg-white/10 mx-1 shrink-0" />

          {/* Price/MCap toggle */}
          <div className="flex rounded border border-white/10 overflow-hidden shrink-0">
            <button
              onClick={() => setPriceMode("price")}
              className={clsx(
                "px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs font-medium transition-colors whitespace-nowrap",
                priceMode === "price" ? "bg-[#00ff88]/15 text-[#00ff88]" : "text-white/35 hover:text-white/60"
              )}
            >
              Price
            </button>
            <button
              onClick={() => setPriceMode("mcap")}
              className={clsx(
                "px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs font-medium transition-colors border-l border-white/10 whitespace-nowrap",
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
                "px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs font-medium transition-colors whitespace-nowrap",
                currencyMode === "usd" ? "bg-[#00ff88]/15 text-[#00ff88]" : "text-white/35 hover:text-white/60"
              )}
            >
              USD
            </button>
            <button
              onClick={() => setCurrencyMode("sol")}
              className={clsx(
                "px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs font-medium transition-colors border-l border-white/10 whitespace-nowrap",
                currencyMode === "sol" ? "bg-[#00ff88]/15 text-[#00ff88]" : "text-white/35 hover:text-white/60"
              )}
            >
              SOL
            </button>
          </div>
        </div>
      </div>

      {/* Chart area — flex-1 so it fills the remaining height inside the fullscreen flex-col wrapper */}
      <div ref={chartAreaRef} className="relative flex flex-1 min-h-0">
        {/* Left toolbar — desktop only */}
        {/* Fix #4: removed non-functional drawing tool buttons (trend line, horizontal line, ray, pen, text, measure) */}
        {/* Fix #5: removed duplicate magnet button at bottom */}
        <div className="hidden sm:flex flex-col items-center gap-0.5 py-2 px-1 border-r border-white/8 bg-[#090909] shrink-0 z-10 w-9">
          {/* Crosshair toggle — functional */}
          <button
            title={crosshairMode === "normal" ? "Normal crosshair" : "Magnet crosshair (active)"}
            onClick={() => {
              if (!chartRef.current) return;
              const next = crosshairMode === "normal" ? "magnet" : "normal";
              setCrosshairMode(next);
              import("lightweight-charts").then(({ CrosshairMode }) => {
                chartRef.current?.applyOptions({
                  crosshair: { mode: next === "magnet" ? CrosshairMode.Magnet : CrosshairMode.Normal },
                });
              });
            }}
            className={clsx(
              "w-7 h-7 flex items-center justify-center rounded transition-colors",
              crosshairMode === "magnet" ? "bg-[#00ff88]/15 text-[#00ff88]" : "text-white/40 hover:text-white hover:bg-white/8"
            )}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <line x1="7" y1="0" x2="7" y2="14" stroke="currentColor" strokeWidth="1.3" />
              <line x1="0" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>

          {/* Fit content — functional */}
          <button
            title="Fit chart to data"
            onClick={() => chartRef.current?.timeScale().fitContent()}
            className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/8 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M1 4V1h3M10 1h3v3M13 10v3h-3M4 13H1v-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>

          {/* Zoom in — functional */}
          <button title="Zoom in" onClick={() => {
            const ts = chartRef.current?.timeScale();
            if (ts) {
              const range = ts.getVisibleLogicalRange();
              if (range) ts.setVisibleLogicalRange({ from: range.from + 5, to: range.to - 5 });
            }
          }} className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/8 transition-colors">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="4" y1="6" x2="8" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="6" y1="4" x2="6" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>

          {/* Fix #6: Zoom out button */}
          <button title="Zoom out" onClick={() => {
            const ts = chartRef.current?.timeScale();
            if (ts) {
              const range = ts.getVisibleLogicalRange();
              if (range) ts.setVisibleLogicalRange({ from: range.from - 10, to: range.to + 10 });
            }
          }} className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/8 transition-colors">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="4" y1="6" x2="8" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>

          <div className="w-5 h-px bg-white/10 my-0.5" />

          {/* Reset zoom */}
          <button title="Reset zoom" onClick={() => chartRef.current?.timeScale().fitContent()} className="w-7 h-7 flex items-center justify-center rounded text-white/25 hover:text-[#ff4444]/70 hover:bg-white/5 transition-colors">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="w-5 h-px bg-white/10 my-0.5" />

          {/* ── Drawing tools — coming soon ─────────────────────────── */}
          {/* Trend line */}
          <button title="Coming soon" disabled className="w-7 h-7 flex items-center justify-center rounded opacity-30 cursor-not-allowed text-white/40">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <line x1="1" y1="13" x2="13" y2="1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="1" cy="13" r="1.5" fill="currentColor" />
              <circle cx="13" cy="1" r="1.5" fill="currentColor" />
            </svg>
          </button>

          {/* Horizontal line */}
          <button title="Coming soon" disabled className="w-7 h-7 flex items-center justify-center rounded opacity-30 cursor-not-allowed text-white/40">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="1" cy="7" r="1.5" fill="currentColor" />
            </svg>
          </button>

          {/* Ray */}
          <button title="Coming soon" disabled className="w-7 h-7 flex items-center justify-center rounded opacity-30 cursor-not-allowed text-white/40">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <line x1="1" y1="13" x2="13" y2="1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 2" />
              <circle cx="1" cy="13" r="1.5" fill="currentColor" />
            </svg>
          </button>

          {/* Pen / freehand */}
          <button title="Coming soon" disabled className="w-7 h-7 flex items-center justify-center rounded opacity-30 cursor-not-allowed text-white/40">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 12 C4 8 6 6 8 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
              <path d="M8 4 L10 2 L12 4 L10 6 Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Text annotation */}
          <button title="Coming soon" disabled className="w-7 h-7 flex items-center justify-center rounded opacity-30 cursor-not-allowed text-white/40 text-[11px] font-bold font-mono">
            T
          </button>

          {/* Ruler / measure */}
          <button title="Coming soon" disabled className="w-7 h-7 flex items-center justify-center rounded opacity-30 cursor-not-allowed text-white/40">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="5" width="12" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <line x1="4" y1="5" x2="4" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="7" y1="5" x2="7" y2="8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="10" y1="5" x2="10" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Chart + overlay layer */}
        <div ref={chartOverlayRef} className="relative flex-1 min-w-0">
        {/* Live trade bubbles */}
        {showBubbles && flashTrades.length > 0 && (
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 pointer-events-none">
            {flashTrades.map((ft) => {
              const tag = getTradeTag(ft.solAmount);
              return (
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
                  {tag && (
                    <span className="text-[10px] font-bold" style={{ color: tag.color }}>
                      {tag.label}
                    </span>
                  )}
                </div>
              );
            })}
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
          <div className="absolute inset-0 z-10 flex items-center justify-center text-white/25 pointer-events-none">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <div className="text-sm">No chart data yet</div>
              <div className="text-xs text-[#444] mt-1">Make the first trade!</div>
            </div>
          </div>
        )}

        <div
          ref={chartContainerRef}
          className="w-full h-[420px] md:h-[500px] lg:h-[580px] overflow-hidden"
          style={fsChartH !== null ? { height: fsChartH } : {}}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,rgba(7,17,15,0),rgba(7,17,15,0.85))]" />

        {/* ── On-chart PnL tag — exchange-style pill anchored to Avg Entry level ── */}
        {/* Profit → tag sits ABOVE the line; Loss → tag sits BELOW the line.        */}
        {/* This mirrors exchange convention and keeps the tag off the line itself.   */}
        {entryLineY !== null && entryPnlBadge && (
          <div
            className="absolute pointer-events-none z-20"
            style={{
              // Profit/neutral: place above line (tag height ~20px + 5px gap = 25px up)
              // Loss: place below line (5px gap below the 1px line)
              top: entryPnlBadge.isLoss
                ? entryLineY + 5
                : Math.max(2, entryLineY - 25),
              left: 8,
            }}
          >
            <div className={clsx(
              "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold opacity-85",
              entryPnlBadge.isProfit
                ? "bg-[#00ff88]/12 text-[#00ff88] border border-[#00ff88]/25"
                : entryPnlBadge.isLoss
                ? "bg-[#ff4444]/12 text-[#ff4444] border border-[#ff4444]/25"
                : "bg-white/[0.05] text-[#888] border border-white/10"
            )}>
              {/* "PnL" prefix — desktop only; mobile shows value only to save space */}
              <span className="hidden sm:inline text-[8px] opacity-60 uppercase tracking-wider mr-0.5">PnL</span>
              <span>{entryPnlBadge.usdStr ?? entryPnlBadge.solStr}</span>
            </div>
          </div>
        )}

        {/* ── Floating trade panel — fullscreen only, draggable ──────────── */}
        {isFullscreen && floatingPanel && (
          <div
            ref={panelRef}
            className="absolute z-30 w-[300px] max-h-[82vh] overflow-y-auto rounded-[24px] shadow-[0_8px_40px_rgba(0,0,0,0.7)] border border-white/10 select-none"
            style={{
              backdropFilter: "blur(20px)",
              background: "rgba(11,11,11,0.94)",
              left:  panelPos ? panelPos.x : undefined,
              top:   panelPos ? panelPos.y : undefined,
              // Before first position calc: hide in bottom-right so no flash
              right:  panelPos ? undefined : 16,
              bottom: panelPos ? undefined : 16,
            }}
          >
            {/* Drag handle header */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-white/8 cursor-grab active:cursor-grabbing"
              style={{ background: "rgba(11,11,11,0.98)" }}
              onMouseDown={(e) => {
                if (!panelRef.current || !chartOverlayRef.current) return;
                isDragging.current = true;
                const ctr = chartOverlayRef.current.getBoundingClientRect();
                const panel = panelRef.current.getBoundingClientRect();
                dragOffset.current = {
                  x: e.clientX - (panel.left - ctr.left),
                  y: e.clientY - (panel.top  - ctr.top),
                };
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                if (!panelRef.current || !chartOverlayRef.current) return;
                isDragging.current = true;
                const touch = e.touches[0];
                const ctr = chartOverlayRef.current.getBoundingClientRect();
                const panel = panelRef.current.getBoundingClientRect();
                dragOffset.current = {
                  x: touch.clientX - (panel.left - ctr.left),
                  y: touch.clientY - (panel.top  - ctr.top),
                };
              }}
            >
              {/* Drag indicator dots */}
              <div className="flex items-center gap-1.5">
                <svg width="10" height="14" viewBox="0 0 10 14" fill="none" className="text-white/20">
                  <circle cx="2" cy="3"  r="1.3" fill="currentColor"/>
                  <circle cx="8" cy="3"  r="1.3" fill="currentColor"/>
                  <circle cx="2" cy="7"  r="1.3" fill="currentColor"/>
                  <circle cx="8" cy="7"  r="1.3" fill="currentColor"/>
                  <circle cx="2" cy="11" r="1.3" fill="currentColor"/>
                  <circle cx="8" cy="11" r="1.3" fill="currentColor"/>
                </svg>
                <span className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">Trade</span>
              </div>
              <button
                onClick={handleFullscreenToggle}
                title="Exit fullscreen (Esc)"
                className="w-6 h-6 flex items-center justify-center rounded text-white/30 hover:text-[#ff4444]/70 hover:bg-white/8 transition-colors text-sm"
                onMouseDown={(e) => e.stopPropagation()}
              >
                ✕
              </button>
            </div>
            {floatingPanel}
          </div>
        )}
        {/* Permanent exit button — top-right of chart area, always visible in fullscreen */}
        {isFullscreen && (
          <button
            onClick={handleFullscreenToggle}
            title="Exit fullscreen (Esc)"
            className="absolute top-3 right-3 z-40 flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#111]/80 px-2.5 py-1.5 text-[11px] font-semibold text-white/50 hover:text-white hover:border-white/30 hover:bg-[#1a1a1a]/90 transition-colors backdrop-blur-sm"
          >
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
              <path d="M5 1v4H1M9 1v4h4M13 9v4H9M5 13v-4H1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Exit
          </button>
        )}
        </div>{/* end chart+overlay layer */}
      </div>{/* end chart area flex */}
    </div>
  );

  return (
    <>
      {chartEl}
      {/* Chart type dropdown — fixed to viewport so overflow-x-auto on toolbar can't clip it */}
      {showChartDropdown && dropdownAnchor && (
        <div
          data-dropdown="charttype"
          style={{ position: "fixed", top: dropdownAnchor.top, left: dropdownAnchor.left, zIndex: 99999 }}
          className="bg-[#111] border border-white/12 rounded-xl overflow-hidden shadow-2xl min-w-[120px]"
        >
          {(["heikinashi", "candles", "line", "area", "bars"] as const).map((type) => (
            <button
              key={type}
              onClick={() => { setChartType(type); setShowChartDropdown(false); }}
              className={clsx(
                "flex items-center justify-between w-full px-3 py-2 text-xs text-left hover:bg-white/6 transition-colors",
                chartType === type ? "text-[#00ff88]" : "text-white/55"
              )}
            >
              <span>
                {type === "heikinashi" ? "Heikin Ashi"
                  : type === "candles" ? "Candles"
                  : type === "line" ? "Line"
                  : type === "area" ? "Area"
                  : "Bars"}
              </span>
              {chartType === type && <span className="text-[#00ff88] text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
