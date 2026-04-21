const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// Base URL of the backend (strips trailing /api).
// Used to rewrite image URLs that might have been stored with a stale host.
const BACKEND_BASE = API_URL.replace(/\/api\/?$/, "");

/**
 * Rewrites a stored imageUrl so it always points to the currently-configured
 * backend host. Fixes stale `http://localhost:4000/uploads/...` URLs when the
 * site is accessed from production or a different machine.
 */
export function resolveImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${BACKEND_BASE}${parsed.pathname}`;
    }
  } catch {
    // Not a valid URL — return as-is
  }
  return url;
}

// ─── Image upload ─────────────────────────────────────────────────────────────
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${API_URL}/upload/image`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    // 413 comes from nginx (client_max_body_size) before Express even sees the
    // request — the body is an HTML error page, not JSON, so we handle it first.
    if (res.status === 413) {
      throw new Error("Image is too large. Please use an image under 5 MB.");
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Image upload failed");
  }
  const data = await res.json();
  return data.url as string;
}

export interface TokenData {
  id: string;
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  creator: string;
  createdAt: string;
  updatedAt: string;
  virtualSolReserves: string;
  virtualTokenReserves: string;
  realSolReserves: string;
  realTokenReserves: string;
  totalSupply: string;
  marketCapSol: number;
  priceUsd: number;
  volume24h: number;
  trades: number;
  holders: number;
  trades15m: number;
  lastTradeAt?: string | null;
  isGraduated: boolean;
  graduatedAt?: string;
  graduationProgress: number;
  currentPrice?: number;
  raydiumPoolId?: string;
}

export interface TradeData {
  id: string;
  signature: string;
  mint: string;
  trader: string;
  type: "BUY" | "SELL";
  solAmount: string;
  tokenAmount: string;
  price: number;
  fee: string;
  timestamp: string;
  createdAt: string;
  token?: {
    name: string;
    symbol: string;
    imageUrl?: string;
  };
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface TokensResponse {
  tokens: TokenData[];
  pagination: PaginationInfo;
}

export interface TradesResponse {
  trades: TradeData[];
  pagination: PaginationInfo;
}

export interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CreateTokenPayload {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  creator: string;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Token endpoints
export async function getTokens(
  sort: "trending" | "new" | "graduating" | "graduated" = "new",
  page = 1,
  limit = 20,
  q?: string
): Promise<TokensResponse> {
  const qs = q ? `&q=${encodeURIComponent(q)}` : "";
  return fetchApi(`/tokens?sort=${sort}&page=${page}&limit=${limit}${qs}`);
}

// Fetch a specific set of tokens by mint address.
// Used by the watchlist tab — avoids the old approach of filtering client-side
// from the newest-50 list, which silently dropped any token older than #50.
export async function getTokensByMints(mints: string[]): Promise<TokensResponse> {
  if (mints.length === 0) {
    return { tokens: [], pagination: { page: 1, limit: 0, total: 0, pages: 0 } };
  }
  // Mint addresses are base58 alphanumeric — safe to join without encoding.
  return fetchApi(`/tokens?mints=${mints.join(",")}`);
}

// Comments
export interface CommentData {
  id: string;
  mint: string;
  wallet: string;
  text: string;
  createdAt: string;
}

export async function getComments(mint: string): Promise<{ comments: CommentData[] }> {
  return fetchApi(`/comments/${mint}`);
}

export function buildCommentMessage(mint: string, text: string): string {
  return `JetForge comment\nmint: ${mint}\ntext: ${text}`;
}

export async function postComment(
  mint: string,
  wallet: string,
  text: string,
  signature: string,
  message: string
): Promise<CommentData> {
  return fetchApi(`/comments/${mint}`, {
    method: "POST",
    body: JSON.stringify({ wallet, text, signature, message }),
  });
}

export async function getToken(mint: string): Promise<TokenData> {
  return fetchApi(`/tokens/${mint}`);
}

export async function getTokensByCreator(creator: string): Promise<TokensResponse> {
  return fetchApi(`/tokens?creator=${creator}&limit=50`);
}

export async function createTokenRecord(
  data: CreateTokenPayload
): Promise<TokenData> {
  return fetchApi("/tokens", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getOHLCV(
  mint: string,
  interval: "1s" | "1m" | "5m" | "15m" | "30m" | "1h" | "1d" = "5m",
  limit = 200
): Promise<OHLCVData[]> {
  return fetchApi(`/tokens/${mint}/ohlcv?interval=${interval}&limit=${limit}`);
}

export async function getRecentTrades(limit = 20): Promise<{ trades: any[] }> {
  return fetchApi(`/trades/recent?limit=${limit}`);
}

export async function getPlatformStats(): Promise<{
  totalTokens: number;
  volume24hSol: number;
  trades24h: number;
}> {
  return fetchApi("/stats");
}

// Trade endpoints
export async function getTrades(
  mint: string,
  page = 1,
  limit = 50
): Promise<TradesResponse> {
  return fetchApi(`/trades/${mint}?page=${page}&limit=${limit}`);
}

export async function getUserTrades(
  wallet: string,
  page = 1
): Promise<TradesResponse & { summary: any }> {
  return fetchApi(`/trades/user/${wallet}?page=${page}`);
}

// Holders endpoint
export async function getTopHolders(mint: string): Promise<{ holders: { wallet: string; amount: number; pct: number }[] }> {
  return fetchApi(`/tokens/${mint}/holders`);
}

// Leaderboard endpoints
export async function getTopTokens(
  metric: "volume" | "marketcap" | "trades" | "new" = "volume",
  limit = 20,
  excludeGraduated = false
): Promise<TokenData[]> {
  const params = new URLSearchParams({ metric, limit: String(limit) });
  if (excludeGraduated) params.set("excludeGraduated", "true");
  return fetchApi(`/leaderboard/tokens?${params}`);
}

export async function getTopTraders(
  metric: "volume" | "trades" = "volume",
  limit = 20
): Promise<any[]> {
  return fetchApi(`/leaderboard/traders?metric=${metric}&limit=${limit}`);
}

// Creator endpoints
export interface CreatorData {
  rank: number;
  wallet: string;
  tokensLaunched: number;
  totalVolumeSol: string;
  totalRaisedSol: string;
  estimatedEarningsSol: string;
  graduatedTokens: number;
  totalTrades: number;
  badge: string;
  badgeLabel: string;
  badgeColor: string;
  latestToken?: { name: string; symbol: string; imageUrl?: string; mint: string } | null;
}

export async function getCreators(
  metric: "volume" | "tokens" = "volume",
  limit = 20
): Promise<CreatorData[]> {
  return fetchApi(`/creators?metric=${metric}&limit=${limit}`);
}

export async function getCreatorProfile(wallet: string): Promise<any> {
  return fetchApi(`/creators/${wallet}`);
}

// Follow endpoints
export interface FollowStats {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export async function getFollowStats(wallet: string, viewer?: string): Promise<FollowStats> {
  const q = viewer ? `?viewer=${viewer}` : "";
  return fetchApi(`/follows/${wallet}/stats${q}`);
}

export async function followCreator(follower: string, following: string): Promise<{ following: boolean; followerCount: number }> {
  return fetchApi("/follows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ follower, following }) });
}

export async function unfollowCreator(follower: string, following: string): Promise<{ following: boolean; followerCount: number }> {
  return fetchApi("/follows", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ follower, following }) });
}

export async function getFollowers(wallet: string, page = 1): Promise<{ followers: { follower: string; createdAt: string }[]; total: number }> {
  return fetchApi(`/follows/${wallet}/followers?page=${page}`);
}

export async function getFollowing(wallet: string, page = 1): Promise<{ following: { following: string; createdAt: string }[]; total: number }> {
  return fetchApi(`/follows/${wallet}/following?page=${page}`);
}

// Utility: format wallet address
export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Utility: format time ago
export function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = (now - then) / 1000;

  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
