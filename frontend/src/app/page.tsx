"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { TokenCard } from "@/components/TokenCard";
import { LiveFeed } from "@/components/LiveFeed";
import { getTokens, getTokensByMints, getTopTokens, getPlatformStats, TokenData, resolveImageUrl } from "@/lib/api";
import { clsx } from "clsx";
import Link from "next/link";

type SortTab = "trending" | "new" | "graduating" | "graduated" | "watchlist";

const TAB_CONFIG = [
  { key: "trending" as SortTab, label: "Trending" },
  { key: "new" as SortTab, label: "New" },
  { key: "graduating" as SortTab, label: "Graduating" },
  { key: "graduated" as SortTab, label: "Graduated" },
  { key: "watchlist" as SortTab, label: "Watchlist" },
];

function CountUpValue({ value }: { value: string }) {
  // Tracks the last numeric value we animated TO (or were interrupted at).
  // null = component has never animated (first mount → animate from 0).
  const prevNumericRef = useRef<number | null>(null);
  // Initialize to formatted zero so the first render shows "0 SOL" / "0.00" etc.
  // rather than the full value — which would produce a visible drop to near-zero
  // when the first interval tick fires at step 1 (≈38 ms into the animation).
  // Non-numeric values fall back to `value` directly (no animation, no flash).
  const [display, setDisplay] = useState(() => {
    const target = Number(value.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(target)) return value;
    const suffix = value.replace(/[0-9.,]/g, "");
    const zero = value.includes(".")
      ? (0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : (0).toLocaleString();
    return `${zero}${suffix}`;
  });

  useEffect(() => {
    const suffix = value.replace(/[0-9.,]/g, "");
    const target = Number(value.replace(/[^0-9.]/g, ""));

    // Non-numeric value (e.g. loading placeholder) — just display as-is.
    if (!Number.isFinite(target)) {
      setDisplay(value);
      prevNumericRef.current = null;
      return;
    }

    const prev = prevNumericRef.current;

    // Value unchanged (guard against float drift with epsilon) — skip animation entirely.
    if (prev !== null && Math.abs(target - prev) < 1e-9) return;

    // First mount: animate 0 → target. Subsequent: animate prev → target.
    const from = prev ?? 0;
    const duration = 700;
    const steps = 18;

    // Mutable locals captured by both the interval callback and the cleanup closure.
    // The cleanup reads `step` and `lastAnimated` at the moment it actually runs,
    // which gives us the correct mid-animation position if interrupted.
    let step = 0;
    let lastAnimated = from;

    const format = (n: number): string =>
      value.includes(".")
        ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : Math.round(n).toLocaleString();

    const timer = setInterval(() => {
      step += 1;
      const n = from + (target - from) * (step / steps);
      lastAnimated = n;
      setDisplay(`${format(n)}${suffix}`);
      if (step >= steps) {
        clearInterval(timer);
        setDisplay(value);              // snap to exact original string (avoids rounding artefacts)
        prevNumericRef.current = target; // record completed value
      }
    }, duration / steps);

    return () => {
      clearInterval(timer);
      // If the animation was interrupted mid-run (new value arrived, or unmount),
      // record where we stopped so the NEXT animation starts from there — not from
      // `from` again — giving a smooth continuation rather than a backward jump.
      if (step > 0 && step < steps) {
        prevNumericRef.current = lastAnimated;
      }
      // step === 0: effect fired but interval never ticked (unmount immediately) — leave prevNumericRef unchanged.
      // step >= steps: completed naturally; prevNumericRef already set inside the interval.
    };
  }, [value]);

  return <span>{display}</span>;
}

function StatsBar() {
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: getPlatformStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const items = [
    { label: "Total Tokens", value: stats?.totalTokens?.toLocaleString() ?? "-", note: "launched on JetForge", badge: "Live" },
    { label: "24h Volume", value: stats ? `${stats.volume24hSol.toLocaleString()} SOL` : "-", note: "bonding curve activity", badge: "Momentum" },
    { label: "24h Trades", value: stats?.trades24h?.toLocaleString() ?? "-", note: "real-time market flow", badge: "Flow" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[14px] border border-white/10 bg-white/[0.05] px-3 py-3 md:rounded-[24px] md:bg-transparent md:p-5 md:shadow-[0_8px_24px_rgba(0,0,0,0.18)] md:[background:linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))]"
        >
          <div className="mb-1.5 flex items-start justify-between gap-1 md:mb-3 md:gap-3">
            <span className="text-[8px] font-semibold uppercase leading-tight tracking-[0.1em] text-white/40 md:text-[11px] md:tracking-[0.24em]">
              {item.label}
            </span>
            <span className="hidden shrink-0 rounded-full bg-[#00ff88]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00ff88] md:inline-flex">
              {item.badge}
            </span>
          </div>
          <div className="truncate text-sm font-extrabold tracking-tight text-white sm:text-base md:text-2xl">
            <CountUpValue value={item.value} />
          </div>
          <div className="mt-0.5 hidden text-sm text-white/50 md:block">{item.note}</div>
        </div>
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="glass-panel h-full rounded-[24px] p-4 animate-pulse">
      <div className="mb-4 flex gap-3">
        <div className="h-14 w-14 rounded-2xl bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded-full bg-white/10" />
          <div className="h-3 w-1/2 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-2xl bg-white/10" />
        ))}
      </div>
      <div className="h-3 rounded-full bg-white/10" />
    </div>
  );
}

const KOTH_INTERVAL = 60; // seconds between rotations

function useKothCountdown() {
  const [secs, setSecs] = useState<number>(() => {
    const now = Date.now();
    return KOTH_INTERVAL - Math.floor((now / 1000) % KOTH_INTERVAL);
  });
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setSecs(KOTH_INTERVAL - Math.floor((now / 1000) % KOTH_INTERVAL));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function KingOfTheHill() {
  const countdown = useKothCountdown();
  const { data } = useQuery({
    queryKey: ["king-of-hill"],
    queryFn: () => getTopTokens("volume", 1, true),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const king = data?.[0];
  const gradPct = king ? Math.min(100, (king.graduationProgress ?? 0)) : 0;
  const urgency = gradPct >= 80 ? "🔴 ALMOST GRADUATED" : gradPct >= 50 ? "🟠 HEATING UP" : "🟢 LIVE NOW";
  const urgencyColor = gradPct >= 80 ? "#ff4444" : gradPct >= 50 ? "#ffaa00" : "#00ff88";

  if (!king) {
    return (
      <div className="relative overflow-hidden rounded-[16px] border border-[#ffcf5a]/20 bg-[linear-gradient(135deg,rgba(255,207,90,0.08),rgba(255,255,255,0.02))] p-3 sm:rounded-[28px] sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#ffcf5a]/12 text-lg sm:h-14 sm:w-14 sm:rounded-2xl sm:text-2xl">
            👑
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#ffcf5a] sm:text-[11px] sm:tracking-[0.34em]">
              King of the Hill
            </div>
            <div className="mt-0.5 text-[13px] font-semibold text-white/70 sm:text-base">
              Waiting for a leader…
            </div>
            <div className="mt-0.5 text-[11px] text-white/45 sm:text-sm">
              The top active token will appear here automatically.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/token/${king.mint}`}>
      <div className="group relative overflow-hidden rounded-[16px] p-[1px] sm:rounded-[28px]">
        <div className="absolute inset-0 animate-gradient-shift rounded-[16px] bg-[linear-gradient(115deg,rgba(255,207,90,0.9),rgba(255,255,255,0.2),rgba(255,207,90,0.95))] sm:rounded-[28px]" />
        <div className="glass-panel-dark relative overflow-hidden rounded-[15px] border border-transparent px-3 py-3 transition-transform duration-200 group-hover:scale-[1.01] sm:rounded-[27px] sm:px-6 sm:py-5 lg:px-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,207,90,0.12),transparent_70%)]" />

          {/* ── Mobile layout ── */}
          <div className="flex items-center gap-3 sm:hidden">
            {/* Token image */}
            <div className="relative shrink-0">
              {resolveImageUrl(king.imageUrl) ? (
                <div className="h-12 w-12 overflow-hidden rounded-[14px] border-2 border-[#ffcf5a]/40 shadow-[0_0_16px_rgba(255,207,90,0.3)]">
                  <img src={resolveImageUrl(king.imageUrl)!} alt={king.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-[14px] border-2 border-[#ffcf5a]/40 bg-[#ffcf5a]/15 text-xl font-bold text-[#ffcf5a] shadow-[0_0_16px_rgba(255,207,90,0.3)]">
                  {king.symbol.slice(0, 2)}
                </div>
              )}
              <span className="absolute -top-1.5 -right-1.5 text-base leading-none">👑</span>
            </div>

            <div className="min-w-0 flex-1">
              {/* Status badge row */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#ffcf5a]">King of the Hill</span>
                <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ backgroundColor: urgencyColor + "22", color: urgencyColor }}>{urgency}</span>
              </div>
              {/* Token name — big & punchy */}
              <div className="flex items-baseline gap-1.5">
                <span className="truncate text-[16px] font-extrabold leading-tight tracking-tight text-white">{king.name}</span>
                <span className="shrink-0 text-[10px] font-mono text-white/45">${king.symbol}</span>
              </div>
              {/* Grad progress bar */}
              <div className="mt-1 flex items-center gap-1.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-all" style={{ width: `${gradPct}%`, background: `linear-gradient(90deg, #00ff88, ${urgencyColor})` }} />
                </div>
                <span className="text-[8px] font-mono font-semibold" style={{ color: urgencyColor }}>{gradPct.toFixed(0)}% to grad</span>
              </div>
              {/* Countdown */}
              <div className="mt-0.5 flex items-center gap-1 text-[8px] text-white/30">
                <span>⏱ Next rotation <span className="font-mono text-[#ffcf5a]/70">{countdown}</span></span>
              </div>
            </div>

            {/* Stats */}
            <div className="shrink-0 text-right">
              <div className="text-[8px] uppercase tracking-[0.1em] text-white/35">Vol 24H</div>
              <div className="text-[14px] font-bold text-white">{king.volume24h.toFixed(0)} SOL</div>
              <div className="text-[8px] uppercase tracking-[0.1em] text-[#ffcf5a]/60">Trades</div>
              <div className="text-[12px] font-bold text-[#fff1c2]">{king.trades}</div>
            </div>
          </div>

          {/* ── Desktop layout ── */}
          <div className="hidden gap-4 sm:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.6fr)] lg:items-center">
            <div className="min-w-0">
              <div className="flex items-start gap-4">
                {/* Token image large */}
                <div className="relative shrink-0">
                  {resolveImageUrl(king.imageUrl) ? (
                    <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-[#ffcf5a]/40 shadow-[0_0_24px_rgba(255,207,90,0.25)]">
                      <img src={resolveImageUrl(king.imageUrl)!} alt={king.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#ffcf5a]/40 bg-[#ffcf5a]/15 text-2xl font-bold text-[#ffcf5a] shadow-[0_0_24px_rgba(255,207,90,0.25)]">
                      {king.symbol.slice(0, 2)}
                    </div>
                  )}
                  <span className="absolute -top-2 -right-2 text-xl leading-none">👑</span>
                </div>

                <div className="min-w-0 flex-1">
                  {/* Title row */}
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#ffcf5a]">King of the Hill</span>
                    <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold" style={{ borderColor: urgencyColor + "40", backgroundColor: urgencyColor + "18", color: urgencyColor }}>{urgency}</span>
                  </div>
                  {/* Token name — huge */}
                  <div className="flex items-baseline gap-2">
                    <span className="line-clamp-1 text-[1.6rem] font-extrabold leading-none tracking-tight text-white">{king.name}</span>
                    <span className="font-mono text-base text-white/45">${king.symbol}</span>
                  </div>
                  {/* Countdown */}
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/35">
                    <span>⏱</span>
                    <span>Next rotation in <span className="font-mono font-semibold text-[#ffcf5a]/80">{countdown}</span></span>
                  </div>
                  {/* Graduation progress bar */}
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[10px]">
                      <span className="text-white/40 uppercase tracking-wider">Graduation Progress</span>
                      <span className="font-mono font-bold" style={{ color: urgencyColor }}>{gradPct.toFixed(1)}% — {gradPct >= 80 ? "Buy before it's gone! 🚨" : gradPct >= 50 ? "Momentum building fast!" : "Early — catch the wave 🌊"}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full transition-all" style={{ width: `${gradPct}%`, background: `linear-gradient(90deg, #00ff88, ${urgencyColor})` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">24H Volume</div>
                <div className="mt-1.5 text-xl font-bold text-white">{king.volume24h.toFixed(2)} SOL</div>
              </div>
              <div className="rounded-2xl border border-[#ffcf5a]/20 bg-[#ffcf5a]/8 p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#ffcf5a]/70">Market Cap</div>
                <div className="mt-1.5 text-xl font-bold text-[#fff1c2]">{king.marketCapSol.toFixed(2)} SOL</div>
              </div>
              <div className="col-span-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 flex items-center justify-between">
                <span className="text-[10px] text-white/35 uppercase tracking-wider">{king.trades} trades · actively pumping</span>
                <span className="text-xs font-bold text-[#00ff88]">Trade now →</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jetforge_watchlist");
      if (saved) setWatchlist(JSON.parse(saved));
    } catch {}
  }, []);

  const toggle = useCallback((mint: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(mint) ? prev.filter((m) => m !== mint) : [...prev, mint];
      localStorage.setItem("jetforge_watchlist", JSON.stringify(next));
      return next;
    });
  }, []);

  return { watchlist, toggle };
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<SortTab>("trending");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { watchlist, toggle } = useWatchlist();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch]);

  const apiSort = activeTab === "watchlist" ? "new" : activeTab === "graduated" ? "graduated" : activeTab;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["tokens", apiSort, page, debouncedSearch],
    queryFn: () => getTokens(apiSort as any, page, 20, debouncedSearch || undefined),
    staleTime: 10_000,
    refetchInterval: 15_000,
    enabled: activeTab !== "watchlist",
  });

  const { data: watchlistData, isLoading: watchlistLoading } = useQuery({
    queryKey: ["tokens-watchlist", watchlist],
    queryFn: () => getTokensByMints(watchlist),
    enabled: activeTab === "watchlist",
    staleTime: 15_000,
  });

  const rawTokens = activeTab === "watchlist" ? (watchlistData?.tokens ?? []) : (data?.tokens ?? []);
  const tokens = rawTokens;
  const pagination = activeTab === "watchlist" ? watchlistData?.pagination : data?.pagination;
  const loading = activeTab === "watchlist" ? watchlistLoading : isLoading;

  return (
    <div className="space-y-5">
      {/*
        StatsBar and KingOfTheHill previously rendered twice — once inside the
        sm:hidden mobile block and once inside the hidden sm:grid desktop block.
        Both DOM trees mounted simultaneously, doubling query subscriptions.

        Fix: one unified container. Mobile hero gets sm:hidden; desktop hero gets
        hidden sm:block. StatsBar / KingOfTheHill render exactly once inside the
        shared left column. Layout and spacing are identical at every breakpoint.
      */}
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_288px] xl:gap-5">
        <div className="min-w-0 space-y-4 sm:space-y-6">

          {/* Mobile hero — hidden at sm and above */}
          <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(135deg,rgba(0,255,136,0.08),rgba(255,255,255,0.02)_42%,rgba(0,204,255,0.06))] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:hidden">
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#86ffc4]">
              Live Market
            </div>
            <div className="mt-1.5 text-[1.85rem] font-extrabold leading-[0.98] tracking-tight text-white">
              Trade what&apos;s moving
            </div>
            <div className="mt-1.5 text-[13px] leading-5 text-white/58">
              Scan activity, check the leader, and jump into the market fast.
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href="#market"
                className="flex-1 rounded-[16px] border border-white/12 bg-white/[0.04] px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                View Market
              </Link>
              <Link
                href="/launch"
                className="flex-1 rounded-[16px] bg-[linear-gradient(90deg,#00ff88,#00e5ff)] px-4 py-2.5 text-center text-sm font-extrabold text-[#03110d]"
              >
                Launch
              </Link>
            </div>
          </div>

          {/* Desktop hero — hidden below sm */}
          <section className="relative hidden overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(0,255,136,0.12),rgba(255,255,255,0.03)_35%,rgba(0,204,255,0.12))] px-4 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:block sm:rounded-[32px] sm:px-8 sm:py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(0,255,136,0.14),transparent_24%)]" />
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px)", backgroundSize: "42px 42px" }} />
            <div className="relative grid gap-5 lg:grid-cols-[1.45fr_0.9fr] lg:items-end">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00ff88]/20 bg-[#00ff88]/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#86ffc4] sm:mb-4 sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.28em]">
                  <span className="live-dot" />
                  Fair-launch momentum on Solana
                </div>
                <h1 className="max-w-2xl text-[2.1rem] font-extrabold leading-none tracking-[-0.04em] text-white sm:text-5xl lg:text-[4.2rem]">
                  The Fairest Token Launch on Solana
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:mt-4 sm:text-lg sm:leading-7">
                  Launch fast, trade instantly, and ride the bonding curve before everyone else. No presales, no insider allocations, just transparent price discovery and pure FOMO.
                </p>
                <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">
                  <Link
                    href="/launch"
                    className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#00ff88_0%,#00e5ff_100%)] px-6 py-3.5 text-sm font-extrabold text-[#03110d] shadow-[0_16px_40px_rgba(0,255,136,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(0,255,136,0.3)]"
                  >
                    Forge a Token
                  </Link>
                  <Link
                    href="#market"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white/78 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                  >
                    Explore Live Market
                  </Link>
                </div>
              </div>

              <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-1">
                {[
                  ["Zero presales", "Pure public discovery from the first trade"],
                  ["Real-time rotation", "Fresh trending charts every few seconds"],
                  ["Auto graduation", "Liquidity progresses toward DEX migration"],
                ].map(([title, desc], index) => (
                  <div
                    key={title}
                    className={clsx("glass-panel rounded-[24px] p-4 text-sm text-white/65", index === 0 && "animate-float")}
                  >
                    <div className="text-sm font-bold text-white">{title}</div>
                    <div className="mt-1 leading-6">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <StatsBar />
          <div className="mt-3 sm:mt-8">
            <KingOfTheHill />
          </div>
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-24">
            <LiveFeed />
          </div>
        </div>
      </div>

      <section id="market" className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
              Live Discovery
            </div>
            <h2 className="mt-2 max-w-[240px] text-[2rem] font-extrabold leading-[1.02] tracking-tight text-white sm:max-w-none sm:text-3xl">
              Find the next chart before it breaks out
            </h2>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
            <div className="relative min-w-0 xl:w-[260px] xl:flex-none">
              <input
                type="text"
                placeholder="Search tokens or creators..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 pl-11 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-4 focus:ring-[#00ff88]/10"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35">🔍</span>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-white/45 transition-colors hover:text-white/75"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-sm scrollbar-none xl:w-fit">
              {TAB_CONFIG.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    "relative min-w-fit shrink-0 rounded-[14px] px-3 py-2.5 text-center text-sm font-semibold whitespace-nowrap transition-all sm:flex-none sm:px-4",
                    activeTab === tab.key
                      ? "bg-white/[0.08] text-white shadow-[inset_0_-2px_0_0_#00ff88,0_8px_20px_rgba(0,255,136,0.08)]"
                      : "text-white/45 hover:text-white/75"
                  )}
                >
                  {tab.key === "watchlist"
                    ? `Watchlist${watchlist.length > 0 ? ` (${watchlist.length})` : ""}`
                    : tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : tokens.length === 0 ? (
          <div className="glass-panel flex min-h-[260px] flex-col items-center justify-center rounded-[28px] px-6 py-16 text-center text-white/40">
            {activeTab === "watchlist" ? (
              <>
                <div className="mb-4 text-5xl">⭐</div>
                <div className="text-xl font-semibold text-white/70">No tokens starred yet</div>
                <div className="mt-2 text-sm text-white/45">Add anything promising to your watchlist and it will show up here.</div>
              </>
            ) : debouncedSearch ? (
              <>
                <div className="mb-4 text-5xl">🔍</div>
                <div className="text-xl font-semibold text-white/70">No results for "{debouncedSearch}"</div>
              </>
            ) : (
              <>
                <div className="mb-4 text-5xl">🚀</div>
                <div className="text-xl font-semibold text-white/70">No tokens live yet</div>
                <div className="mt-2 text-sm">
                  Be the first to{" "}
                  <a href="/launch" className="font-semibold text-[#00ff88] hover:underline">launch a token</a>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div
              className={clsx(
                "grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
                isFetching && "opacity-85 transition-opacity"
              )}
            >
              {tokens.map((token: TokenData) => (
                <TokenCard
                  key={token.mint}
                  token={token}
                  isWatched={watchlist.includes(token.mint)}
                  onWatchToggle={() => toggle(token.mint)}
                />
              ))}
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Prev
                </button>
                <span className="text-sm text-white/45">{page} / {pagination.pages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

    </div>
  );
}
