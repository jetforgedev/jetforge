"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useToken } from "@/hooks/useTokenData";
import { TradingPanel } from "@/components/TradingPanel";
import { PriceChart } from "@/components/PriceChart";
import { GraduationBar } from "@/components/GraduationBar";
import { TradesList } from "@/components/TradesList";
import { truncateAddress, timeAgo } from "@/lib/api";
import { formatSol } from "@/lib/bondingCurve";
import BN from "bn.js";
import { useConnection, useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useQuery } from "@tanstack/react-query";
import { getTopHolders } from "@/lib/api";
import { PROGRAM_ID, TREASURY, getBuybackVaultPDA, getCreatorVaultPDA, buildWithdrawCreatorFeesTransaction } from "@/lib/program";
import { useTrades as useLiveTrades } from "@/hooks/useTrades";
import { TokenComments } from "@/components/TokenComments";
import { useSocket } from "@/hooks/useLiveFeed";
import { getCreatorProfile } from "@/lib/api";

interface PageProps {
  params: Promise<{ mint: string }>;
}

function TokenSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-24 bg-[#111] rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-64 bg-[#111] rounded-xl" />
          <div className="h-48 bg-[#111] rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="h-80 bg-[#111] rounded-xl" />
          <div className="h-32 bg-[#111] rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function TokenSyncing({ mint }: { mint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="w-12 h-12 rounded-full border-2 border-[#00ff88] border-t-transparent animate-spin" />
      <div className="text-center">
        <div className="text-white font-semibold mb-1">Indexing token…</div>
        <div className="text-[#555] text-sm max-w-xs">
          Your token is live on-chain. The indexer is syncing it now — this usually takes a few seconds.
        </div>
      </div>
      <div className="font-mono text-[#333] text-xs break-all max-w-xs text-center">{mint}</div>
      <Link href="/" className="text-xs text-[#555] hover:text-white border border-[#2a2a2a] px-3 py-1.5 rounded-md transition-colors">
        ← Back to Home
      </Link>
    </div>
  );
}

const TOTAL_SUPPLY = 1_000_000_000; // 1B tokens (UI display, no decimals)

function HoldersTable({ mint, creator }: { mint: string; creator: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["holders", mint],
    queryFn: () => getTopHolders(mint),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Compute platform addresses to exclude from holders list
  const bondingCurvePDA = React.useMemo(() => {
    try {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding_curve"), new PublicKey(mint).toBytes()],
        PROGRAM_ID
      );
      return pda.toBase58();
    } catch { return ""; }
  }, [mint]);

  const PLATFORM_WALLETS = new Set([
    TREASURY.toBase58(),
    bondingCurvePDA,
  ]);

  // Deduplicate by wallet address and filter out platform/program-owned wallets
  const seen = new Set<string>();
  const holders = (data?.holders ?? []).filter((h) => {
    if (seen.has(h.wallet)) return false;
    if (PLATFORM_WALLETS.has(h.wallet)) return false;
    seen.add(h.wallet);
    return true;
  });

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="text-white text-sm font-semibold">Top Holders</div>
        <div className="text-[#555] text-xs">Live · devnet</div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-[#1a1a1a] rounded animate-pulse" />
          ))}
        </div>
      ) : holders.length === 0 ? (
        <div className="p-6 text-center text-[#555] text-sm">
          No holders yet — be the first to buy!
        </div>
      ) : (
        <div className="divide-y divide-[#0f0f0f]">
          {holders.map((h, i) => {
            const isCreator = h.wallet === creator;
            const barColor =
              h.pct > 20 ? "bg-[#ff4444]" :
              h.pct > 10 ? "bg-[#ffaa00]" :
              i === 0    ? "bg-[#00ff88]" :
                           "bg-[#333]";

            return (
              <div key={h.wallet} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#0f0f0f] transition-colors">
                {/* Rank */}
                <div className="text-[#444] text-xs font-mono w-4 shrink-0 text-right">
                  {i + 1}
                </div>

                {/* Wallet + labels */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#888] font-mono text-xs">
                      {h.wallet.slice(0, 4)}...{h.wallet.slice(-4)}
                    </span>
                    {isCreator && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#ffaa0015] border border-[#ffaa0030] text-[#ffaa00]">
                        dev
                      </span>
                    )}
                    {i === 0 && !isCreator && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#00ff8810] border border-[#00ff8830] text-[#00ff88]">
                        top
                      </span>
                    )}
                  </div>
                  {/* Bar */}
                  <div className="mt-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden w-full">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(h.pct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Amount + pct */}
                <div className="text-right shrink-0">
                  <div className="text-white text-xs font-mono font-semibold">
                    {h.pct.toFixed(2)}%
                  </div>
                  <div className="text-[#555] text-[10px] font-mono">
                    {h.amount.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const BUYBACK_THRESHOLD_SOL = 0.1;
const WHALE_THRESHOLD_SOL = 1;

function useWhaleAlert(mint: string) {
  const socket = useSocket();
  const [whale, setWhale] = React.useState<{ type: string; sol: number; trader: string } | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!socket || !mint) return;
    socket.on("new_trade", (trade: any) => {
      if (trade.mint !== mint) return;
      const sol = Number(trade.solAmount) / 1e9;
      if (sol >= WHALE_THRESHOLD_SOL) {
        setWhale({ type: trade.type, sol, trader: trade.trader });
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setWhale(null), 6000);
      }
    });
    return () => { socket.off("new_trade"); if (timer.current) clearTimeout(timer.current); };
  }, [socket, mint]);

  return whale;
}

function usePriceAlert(mint: string, currentMcapSol: number) {
  const [target, setTarget] = React.useState<number | null>(() => {
    try { const v = localStorage.getItem(`alert_${mint}`); return v ? parseFloat(v) : null; } catch { return null; }
  });
  const [triggered, setTriggered] = React.useState(false);

  React.useEffect(() => {
    if (target === null || triggered) return;
    if (currentMcapSol >= target) {
      setTriggered(true);
      if (Notification.permission === "granted") {
        new Notification("🚀 Price Alert!", { body: `Market cap reached ${target} SOL!` });
      }
    }
  }, [currentMcapSol, target, triggered]);

  const saveTarget = (val: number | null) => {
    setTarget(val);
    setTriggered(false);
    try {
      if (val === null) localStorage.removeItem(`alert_${mint}`);
      else localStorage.setItem(`alert_${mint}`, val.toString());
    } catch {}
  };

  return { target, setTarget: saveTarget, triggered };
}

function PriceAlertWidget({ mint, currentMcapSol }: { mint: string; currentMcapSol: number }) {
  const { target, setTarget, triggered } = usePriceAlert(mint, currentMcapSol);
  const [inputVal, setInputVal] = React.useState(target?.toString() ?? "");
  const [open, setOpen] = React.useState(false);

  const save = () => {
    const v = parseFloat(inputVal);
    if (isNaN(v) || v <= 0) { setTarget(null); setOpen(false); return; }
    if (Notification.permission === "default") Notification.requestPermission();
    setTarget(v);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 text-xs border px-2.5 py-1 rounded-md font-medium transition-colors ${
          triggered ? "border-[#00ff8840] bg-[#00ff8815] text-[#00ff88]"
          : target ? "border-[#ffaa0040] bg-[#ffaa0015] text-[#ffaa00]"
          : "border-[#2a2a2a] text-[#555] hover:text-[#888]"
        }`}
      >
        🔔 {triggered ? "Triggered!" : target ? `Alert: ${target} SOL` : "Set Alert"}
      </button>
      {open && (
        <div className="absolute right-0 top-9 bg-[#111] border border-[#1a1a1a] rounded-xl p-3 z-30 shadow-xl w-56">
          <div className="text-[#555] text-xs mb-2">Alert when market cap reaches:</div>
          <div className="flex gap-2">
            <input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="e.g. 50"
              className="flex-1 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
            />
            <span className="text-[#555] text-xs self-center">SOL</span>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={save} className="flex-1 bg-[#00ff8820] text-[#00ff88] border border-[#00ff8830] rounded-lg py-1.5 text-xs font-semibold">Save</button>
            {target && <button onClick={() => { setTarget(null); setInputVal(""); setOpen(false); }} className="px-2 text-[#ff4444] border border-[#ff444430] rounded-lg text-xs">✕</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function SocialProofStrip({ mint, trades, holders }: { mint: string; trades: number; holders: number }) {
  const { trades: liveTrades } = useLiveTrades(mint);
  const recentCount = liveTrades.length;

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl text-xs overflow-x-auto">
      {recentCount > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-block w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
          <span className="text-[#00ff88] font-semibold">{recentCount}</span>
          <span className="text-[#555]">trade{recentCount !== 1 ? "s" : ""} since you opened this page</span>
        </div>
      )}
      {recentCount === 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-block w-2 h-2 rounded-full bg-[#333]" />
          <span className="text-[#555]">Waiting for trades…</span>
        </div>
      )}
      <div className="h-3 w-px bg-[#1a1a1a] shrink-0" />
      <span className="text-[#555] shrink-0">
        <span className="text-[#888] font-semibold">{trades.toLocaleString()}</span> total trades
      </span>
      <div className="h-3 w-px bg-[#1a1a1a] shrink-0" />
      <span className="text-[#555] shrink-0">
        <span className="text-[#888] font-semibold">{holders.toLocaleString()}</span> holders
      </span>
    </div>
  );
}


const GRADUATION_SOL = 0.5; // SOL target for graduation

function BondingCurveVisual({ graduationProgress, realSolReserves }: { graduationProgress: number; realSolReserves: string }) {
  const pct = Math.min(100, Math.max(0, graduationProgress));
  const solRaised = Number(realSolReserves) / 1e9;
  const solLeft = Math.max(0, GRADUATION_SOL - solRaised);

  // Generate curve points (hyperbolic bonding curve shape)
  const W = 280; const H = 90;
  const points: string[] = [];
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    const x = t * W;
    // Bonding curve: price accelerates as supply decreases
    const y = H - H * (1 - Math.pow(1 - t, 1.8));
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const polyline = points.join(" ");

  // Current position on the curve
  const curT = pct / 100;
  const curX = curT * W;
  const curY = H - H * (1 - Math.pow(1 - curT, 1.8));

  // Milestones
  const milestones = [25, 50, 75];

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-white text-sm font-semibold">Bonding Curve</div>
        <div className="flex items-center gap-3 text-xs text-[#555]">
          <span><span className="text-[#00ff88] font-mono">{solRaised.toFixed(2)}</span> SOL raised</span>
          <span><span className="text-[#ffaa00] font-mono">{solLeft.toFixed(2)}</span> SOL to graduation</span>
        </div>
      </div>

      <div className="relative">
        <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} preserveAspectRatio="none" className="overflow-visible">
          {/* Background grid lines */}
          {milestones.map((m) => (
            <line key={m} x1={(m / 100) * W} y1="0" x2={(m / 100) * W} y2={H} stroke="#1a1a1a" strokeWidth="1" strokeDasharray="3,3" />
          ))}

          {/* Filled area under curve (progress) */}
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00ff88" stopOpacity="0.15" />
              <stop offset={`${pct}%`} stopColor="#00ff88" stopOpacity="0.08" />
              <stop offset={`${pct}%`} stopColor="#1a1a1a" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#1a1a1a" stopOpacity="0.05" />
            </linearGradient>
            <clipPath id="progressClip">
              <rect x="0" y="0" width={curX} height={H + 5} />
            </clipPath>
          </defs>

          {/* Full curve (faded) */}
          <polyline points={polyline} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />

          {/* Progress curve (bright) */}
          <polyline points={polyline} fill="none" stroke="#00ff88" strokeWidth="2" clipPath="url(#progressClip)" />

          {/* Area fill */}
          <polygon
            points={`0,${H} ${polyline} ${W},${H}`}
            fill="url(#curveGradient)"
          />

          {/* Milestone markers */}
          {milestones.map((m) => {
            const mt = m / 100;
            const my = H - H * (1 - Math.pow(1 - mt, 1.8));
            return (
              <text key={m} x={(m / 100) * W} y={H + 14} textAnchor="middle" fill="#333" fontSize="8">{m}%</text>
            );
          })}
          <text x="0" y={H + 14} textAnchor="start" fill="#333" fontSize="8">0%</text>
          <text x={W} y={H + 14} textAnchor="end" fill="#555" fontSize="8">🎓 100%</text>

          {/* Current position dot */}
          {pct > 0 && (
            <>
              <circle cx={curX} cy={curY} r="5" fill="#00ff88" opacity="0.2" />
              <circle cx={curX} cy={curY} r="3" fill="#00ff88" />
              {/* Tooltip line */}
              <line x1={curX} y1={curY} x2={curX} y2={H} stroke="#00ff88" strokeWidth="1" strokeDasharray="2,2" opacity="0.4" />
              {/* Percentage label */}
              <text
                x={Math.min(Math.max(curX, 20), W - 20)}
                y={Math.max(curY - 7, 10)}
                textAnchor="middle"
                fill="#00ff88"
                fontSize="9"
                fontWeight="bold"
              >
                {pct.toFixed(1)}%
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Bottom bar */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00ff88] to-[#00cc6e] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[#555] text-[10px] shrink-0">
          {pct >= 100 ? "🎓 Ready!" : `${(100 - pct).toFixed(1)}% remaining`}
        </span>
      </div>
    </div>
  );
}

function useBuybackVault(mint: string) {
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["buyback-vault", mint],
    enabled: !!mint,
    queryFn: async () => {
      try {
        const mintPk = new PublicKey(mint);
        const [vaultPDA] = getBuybackVaultPDA(mintPk);
        const lamports = await connection.getBalance(vaultPDA);
        return lamports / 1e9;
      } catch {
        return 0;
      }
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

function useCreatorVault(mint: string) {
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["creator-vault", mint],
    enabled: !!mint,
    queryFn: async () => {
      try {
        const mintPk = new PublicKey(mint);
        const [vaultPDA] = getCreatorVaultPDA(mintPk);
        const lamports = await connection.getBalance(vaultPDA);
        return lamports / 1e9;
      } catch {
        return 0;
      }
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

function useDevHoldings(mint: string, creator: string) {
  const { connection } = useConnection();
  return useQuery({
    queryKey: ["dev-holdings", mint, creator],
    enabled: !!mint && !!creator,
    queryFn: async () => {
      const mintPk = new PublicKey(mint);
      const creatorPk = new PublicKey(creator);
      const ata = getAssociatedTokenAddressSync(mintPk, creatorPk);
      try {
        const info = await connection.getTokenAccountBalance(ata);
        const held = Number(info.value.uiAmount ?? 0);
        const pct = (held / TOTAL_SUPPLY) * 100;
        return { held, pct };
      } catch {
        return { held: 0, pct: 0 };
      }
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export default function TokenPage({ params }: PageProps) {
  const { mint } = React.use(params);
  const { data: token, isLoading, error } = useToken(mint);
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const [withdrawing, setWithdrawing] = React.useState(false);
  const [withdrawMsg, setWithdrawMsg] = React.useState<string | null>(null);

  // All hooks must be called before any early returns
  const { data: devHoldings } = useDevHoldings(mint, token?.creator ?? "");
  const { data: buybackSol = 0 } = useBuybackVault(mint);
  const { data: creatorVaultSol = 0, refetch: refetchCreatorVault } = useCreatorVault(mint);
  const { data: solPrice } = useQuery<number>({
    queryKey: ["sol-price"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
      );
      const data = await res.json();
      return data?.solana?.usd ?? null;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const whale = useWhaleAlert(mint);

  // Verified creator: has at least 1 graduated token
  const { data: creatorProfile } = useQuery({
    queryKey: ["creator-profile", token?.creator],
    queryFn: () => getCreatorProfile(token!.creator),
    enabled: !!token?.creator,
    staleTime: 120_000,
  });
  const isVerifiedCreator = (creatorProfile?.graduatedTokens ?? 0) >= 1;

  if (isLoading) return <TokenSkeleton />;
  if (error || !token) return <TokenSyncing mint={mint} />;

  const isCreator = publicKey?.toBase58() === token.creator;

  const handleWithdraw = async () => {
    if (!anchorWallet || !isCreator) return;
    setWithdrawing(true);
    setWithdrawMsg(null);
    try {
      const tx = await buildWithdrawCreatorFeesTransaction({
        connection,
        wallet: anchorWallet,
        mintAddress: mint,
      });
      const signedTx = await anchorWallet.signTransaction(tx);
      const rawTx = signedTx.serialize();
      const txSig = await connection.sendRawTransaction(rawTx, { skipPreflight: false });
      await connection.confirmTransaction(txSig, "confirmed");
      setWithdrawMsg(`✅ Withdrawn! Tx: ${txSig.slice(0, 16)}...`);
      refetchCreatorVault();
    } catch (e: any) {
      const msg: string = e?.message ?? "Transaction failed";
      if (msg.includes("InsufficientSolReserves") || msg.includes("0x1774")) {
        setWithdrawMsg("❌ No fees to withdraw yet — fees accumulate as users trade your token.");
      } else {
        setWithdrawMsg(`❌ ${msg}`);
      }
    } finally {
      setWithdrawing(false);
    }
  };

  // After graduation realSolReserves resets to 0 (SOL moves to Raydium).
  // Show volume24h as the meaningful metric for graduated tokens.
  const realSolRaised = token.isGraduated
    ? (token.volume24h ?? 0).toFixed(3)
    : (Number(token.realSolReserves) / 1e9).toFixed(3);
  // Market cap = (virtualSol / virtualTokens) * totalSupply, already computed
  // server-side and stored as token.marketCapSol (SOL units).
  const marketCapUsdt = solPrice
    ? `$${(token.marketCapSol * solPrice).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
    : `${token.marketCapSol.toFixed(2)} SOL`;

  const devPct = devHoldings?.pct ?? 0;
  const devHoldingColor =
    devPct === 0 ? "text-[#00ff88]" :
    devPct < 5   ? "text-[#888]" :
    devPct < 15  ? "text-[#ffaa00]" :
                   "text-[#ff4444]";

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#555]">
        <Link href="/" className="hover:text-[#888] transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-[#888]">{token.symbol}</span>
      </div>

      {/* Token header */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Token image */}
          <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#1a1a1a]">
            {token.imageUrl ? (
              <Image
                src={token.imageUrl}
                alt={token.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-[#00ff88]">
                {token.symbol.slice(0, 2)}
              </div>
            )}
          </div>

          {/* Token info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-white">{token.name}</h1>
              <span className="text-[#555] font-mono text-sm">${token.symbol}</span>
              {token.isGraduated && (
                <span className="px-2 py-0.5 bg-[#7c3aed20] border border-[#7c3aed40] rounded-full text-[#a78bfa] text-xs font-medium">
                  🎓 Graduated
                </span>
              )}
              <span className="px-2 py-0.5 bg-[#00ff8810] border border-[#00ff8830] rounded-full text-[#00ff88] text-xs">
                🛡️ Anti-Rug
              </span>
              {isVerifiedCreator && (
                <span className="px-2 py-0.5 bg-[#1d9bf015] border border-[#1d9bf030] rounded-full text-[#1d9bf0] text-xs font-medium" title="Creator has at least 1 graduated token">
                  ✓ Verified Creator
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  devPct === 0
                    ? "bg-[#00ff8810] border-[#00ff8830] text-[#00ff88]"
                    : devPct < 5
                    ? "bg-[#88888810] border-[#88888830] text-[#888]"
                    : devPct < 15
                    ? "bg-[#ffaa0015] border-[#ffaa0030] text-[#ffaa00]"
                    : "bg-[#ff444415] border-[#ff444430] text-[#ff4444]"
                }`}
                title="% of total supply held by token creator"
              >
                Dev: {devPct.toFixed(1)}%
              </span>
            </div>
            <div className="text-[#555] text-xs mt-1">
              Created by{" "}
              <span className="text-[#888] font-mono">{truncateAddress(token.creator)}</span>
              {" · "}
              {timeAgo(token.createdAt)}
            </div>
            {token.description && (
              <p className="text-[#666] text-sm mt-2 max-w-2xl line-clamp-2">
                {token.description}
              </p>
            )}
          </div>

          {/* Social links + Share */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {token.websiteUrl && (
              <a href={token.websiteUrl} target="_blank" rel="noopener noreferrer"
                className="text-[#555] hover:text-white transition-colors text-xs border border-[#2a2a2a] px-2 py-1 rounded-md">
                🌐 Website
              </a>
            )}
            {token.twitterUrl && (
              <a href={token.twitterUrl} target="_blank" rel="noopener noreferrer"
                className="text-[#555] hover:text-white transition-colors text-xs border border-[#2a2a2a] px-2 py-1 rounded-md">
                𝕏 Twitter
              </a>
            )}
            {token.telegramUrl && (
              <a href={token.telegramUrl} target="_blank" rel="noopener noreferrer"
                className="text-[#555] hover:text-white transition-colors text-xs border border-[#2a2a2a] px-2 py-1 rounded-md">
                ✈️ Telegram
              </a>
            )}
            {/* Share on X */}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                `Just found $${token.symbol} on JetForge! 🚀\n\nMarket cap: ${marketCapUsdt}\n\nTrade it here 👇`
              )}&url=${encodeURIComponent(`https://jetforge.io/token/${mint}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs border border-[#1d9bf030] bg-[#1d9bf010] text-[#1d9bf0] hover:bg-[#1d9bf020] transition-colors px-2.5 py-1 rounded-md font-medium"
            >
              𝕏 Share
            </a>
            <PriceAlertWidget mint={mint} currentMcapSol={token.marketCapSol} />
          </div>
        </div>
      </div>

      {/* Whale alert banner */}
      {whale && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold animate-slide-in ${
          whale.type === "BUY"
            ? "bg-[#00ff8810] border-[#00ff8830] text-[#00ff88]"
            : "bg-[#ff444410] border-[#ff444430] text-[#ff4444]"
        }`}>
          <span className="text-xl">🐳</span>
          <span>Whale Alert!</span>
          <span className="font-mono text-white">{whale.sol.toFixed(2)} SOL</span>
          <span className="text-[#888] font-normal">{whale.type}</span>
          <span className="text-[#555] text-xs font-mono font-normal">{whale.trader.slice(0, 4)}...{whale.trader.slice(-4)}</span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Market Cap", value: marketCapUsdt, accent: true },
          { label: token.isGraduated ? "24h Volume" : "SOL Raised", value: `${realSolRaised} SOL` },
          { label: "Holders", value: token.holders.toLocaleString() },
          { label: "Total Trades", value: token.trades.toLocaleString() },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3"
          >
            <div className="text-[#555] text-xs mb-1">{stat.label}</div>
            <div
              className={`font-mono font-semibold text-sm ${
                stat.accent ? "text-[#00ff88]" : "text-white"
              }`}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Social proof strip */}
      <SocialProofStrip mint={mint} trades={token.trades} holders={token.holders} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart — mobile: order 1, desktop: col-span-2 */}
        <div className="lg:col-span-2 order-1">
          <PriceChart mint={mint} symbol={token.symbol} solPrice={solPrice ?? null} creator={token.creator} />
        </div>

        {/* Trading panel — mobile: order 2 (right after chart), desktop: right col spans all rows */}
        <div className="space-y-4 order-2 lg:row-span-3">
          <TradingPanel token={token} />

          {/* Token details */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
            <div className="text-white text-sm font-semibold mb-3">Token Details</div>
            <div className="space-y-2.5 text-xs">
              {[
                { label: "Mint Address", value: truncateAddress(mint, 8), copyable: true, full: mint },
                { label: "Total Supply", value: "1,000,000,000" },
                { label: "Decimals", value: "6" },
                { label: "SOL in Curve", value: `${(Number(token.realSolReserves) / 1e9).toFixed(3)} SOL` },
              ].map(({ label, value, copyable, full }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[#555]">{label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[#888] font-mono">{value}</span>
                    {copyable && full && (
                      <button
                        onClick={() => navigator.clipboard.writeText(full)}
                        className="text-[#444] hover:text-[#888] transition-colors"
                        title="Copy address"
                      >
                        📋
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Dev holdings — key transparency metric */}
              <div className="pt-2 mt-2 border-t border-[#1a1a1a]">
                <div className="flex justify-between items-center">
                  <span className="text-[#555]">Dev Holdings</span>
                  <span className={`font-mono font-semibold ${devHoldingColor}`}>
                    {devPct.toFixed(2)}%
                    {devPct === 0 && " ✓ sold/none"}
                    {devPct > 0 && devPct < 5 && " · low"}
                    {devPct >= 5 && devPct < 15 && " · medium ⚠️"}
                    {devPct >= 15 && " · high ⚠️"}
                  </span>
                </div>
                <div className="mt-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      devPct === 0 ? "bg-[#00ff88]" :
                      devPct < 5   ? "bg-[#888]" :
                      devPct < 15  ? "bg-[#ffaa00]" :
                                     "bg-[#ff4444]"
                    }`}
                    style={{ width: `${Math.min(devPct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Buyback & Burn vault */}
              <div className="pt-2 mt-2 border-t border-[#1a1a1a]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[#555]">🔥 Buyback Vault</span>
                  <span className="font-mono text-xs text-[#888]">
                    {buybackSol.toFixed(4)} / {BUYBACK_THRESHOLD_SOL} SOL
                  </span>
                </div>
                <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#ff6600] transition-all"
                    style={{ width: `${Math.min((buybackSol / BUYBACK_THRESHOLD_SOL) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-[#444] text-[10px] mt-1">
                  Burns tokens automatically at {BUYBACK_THRESHOLD_SOL} SOL threshold
                </div>
              </div>

              {/* Creator earnings vault */}
              <div className="pt-2 mt-2 border-t border-[#1a1a1a]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#555]">💰 Creator Earnings</span>
                  <Link
                    href={`/creators/${token.creator}`}
                    className="text-[#444] hover:text-[#888] text-[10px] transition-colors"
                  >
                    View Profile →
                  </Link>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs text-[#00ff88] font-semibold">
                      {creatorVaultSol.toFixed(4)} SOL
                    </span>
                    {solPrice && (
                      <span className="text-[#444] text-[10px] ml-1">
                        ≈ ${(creatorVaultSol * solPrice).toFixed(2)}
                      </span>
                    )}
                  </div>

                  {isCreator && (
                    <button
                      onClick={handleWithdraw}
                      disabled={withdrawing || creatorVaultSol <= 0.001}
                      className="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-[#00ff88] text-black hover:bg-[#00dd77] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {withdrawing ? "..." : "Withdraw"}
                    </button>
                  )}
                </div>

                {withdrawMsg && (
                  <div className="mt-1.5 text-[10px] text-[#888] break-all">{withdrawMsg}</div>
                )}

                <div className="text-[#333] text-[10px] mt-1">
                  40% of all trading fees · withdrawable anytime
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Graduation bar — mobile: order 3, desktop: col-span-2 row 2 */}
        <div className="lg:col-span-2 order-3 space-y-4">
          <GraduationBar
            realSolReserves={token.realSolReserves}
            isGraduated={token.isGraduated}
            mint={mint}
            raydiumPoolId={token.raydiumPoolId ?? undefined}
          />
          {/* Bonding curve visualizer */}
          {!token.isGraduated && (
            <BondingCurveVisual graduationProgress={token.graduationProgress} realSolReserves={token.realSolReserves} />
          )}
        </div>

        {/* Holders + Trades — mobile: order 4 & 5, desktop: col-span-2 rows 3-4 */}
        <div className="lg:col-span-2 order-4">
          <HoldersTable mint={mint} creator={token.creator} />
        </div>
        <div className="lg:col-span-2 order-5">
          <TradesList mint={mint} symbol={token.symbol} />
        </div>
        <div className="lg:col-span-2 order-6">
          <TokenComments mint={mint} />
        </div>
      </div>
    </div>
  );
}
