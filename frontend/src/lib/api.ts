const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// ─── Image upload ─────────────────────────────────────────────────────────────
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${API_URL}/upload/image`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
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

export async function postComment(mint: string, wallet: string, text: string): Promise<CommentData> {
  return fetchApi(`/comments/${mint}`, {
    method: "POST",
    body: JSON.stringify({ wallet, text }),
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
  limit = 20
): Promise<TokenData[]> {
  return fetchApi(`/leaderboard/tokens?metric=${metric}&limit=${limit}`);
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
