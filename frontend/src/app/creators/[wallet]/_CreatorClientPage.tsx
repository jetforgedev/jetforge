"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { getCreatorProfile, truncateAddress, timeAgo, resolveImageUrl, getFollowStats, followCreator, unfollowCreator } from "@/lib/api";
import { useSolPrice, solToUsd } from "@/hooks/useSolPrice";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.jetforge.io";
const JWT_KEY = "jetforge_jwt";

function ReputationBadge({ badge, label, color }: { badge: string; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
      style={{ borderColor: color + "40", backgroundColor: color + "15", color }}
    >
      {badge} {label}
    </span>
  );
}

function Avatar({ avatarUrl, wallet, size = 56 }: { avatarUrl?: string | null; wallet: string; size?: number }) {
  const initials = wallet.slice(0, 2).toUpperCase();
  const colors = ["#00ff88", "#ff6b35", "#7b68ee", "#FFD700", "#00bfff"];
  const color = colors[parseInt(wallet.slice(0, 8), 16) % colors.length] || "#00ff88";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Avatar"
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0 text-black"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(JWT_KEY);
}

function setToken(token: string) {
  if (typeof window !== "undefined") localStorage.setItem(JWT_KEY, token);
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() / 1000 > payload.exp;
  } catch {
    return true;
  }
}

export default function CreatorClientPage({ wallet }: { wallet: string }) {
  const { publicKey, signMessage } = useWallet();
  const queryClient = useQueryClient();
  const viewer = publicKey?.toBase58();
  const isOwn = viewer === wallet;

  const solPrice = useSolPrice();

  // Profile state
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Posts state
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: "", bio: "", twitterUrl: "", websiteUrl: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Post compose state
  const [postContent, setPostContent] = useState("");
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postError, setPostError] = useState("");

  // Follow state
  const [followData, setFollowData] = useState<{ followerCount: number; followingCount: number; following: boolean }>({
    followerCount: 0, followingCount: 0, following: false,
  });

  // Referral state
  const [referralStats, setReferralStats] = useState<any>({ totalEarned: 0, totalReferrals: 0, hasReferralAccount: false });
  const [referralDashboard, setReferralDashboard] = useState<any>({});
  const [withdrawing, setWithdrawing] = useState(false);

  const { data: creator, isLoading: creatorLoading, error: creatorError } = useQuery({
    queryKey: ["creator-profile", wallet],
    queryFn: () => getCreatorProfile(wallet),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  // Fetch social profile
  useEffect(() => {
    setProfileLoading(true);
    fetch(`${API_BASE}/api/creators/${wallet}/profile`)
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setFollowData({
          followerCount: data.followerCount ?? 0,
          followingCount: data.followingCount ?? 0,
          following: false,
        });
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [wallet]);

  // Fetch follow status
  useEffect(() => {
    if (!viewer) return;
    fetch(`${API_BASE}/api/creators/${wallet}/follow-status?viewer=${viewer}`)
      .then((r) => r.json())
      .then((data) => setFollowData((prev) => ({ ...prev, following: data.following })))
      .catch(() => {});
  }, [wallet, viewer]);

  // Fetch posts
  useEffect(() => {
    setPostsLoading(true);
    fetch(`${API_BASE}/api/creators/${wallet}/posts`)
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false));
  }, [wallet]);

  // Fetch public referral stats
  useEffect(() => {
    fetch(`${API_BASE}/api/referral/stats/${wallet}`)
      .then((r) => r.json())
      .then(setReferralStats)
      .catch(() => {});
  }, [wallet]);

  // Fetch private dashboard (owner only)
  useEffect(() => {
    if (!isOwn) return;
    const token = localStorage.getItem(JWT_KEY);
    if (!token) return;
    fetch(`${API_BASE}/api/referral/code`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(() => fetch(`${API_BASE}/api/referral/dashboard`, { headers: { Authorization: `Bearer ${token}` } }))
      .then((r) => r.json())
      .then(setReferralDashboard)
      .catch(() => {});
  }, [isOwn]);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const token = localStorage.getItem(JWT_KEY);
      const r = await fetch(`${API_BASE}/api/referral/withdraw`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.ok) {
        alert(data.message);
        setReferralDashboard((prev: any) => ({ ...prev, pendingBalance: 0, canWithdraw: false }));
      } else {
        alert(data.error);
      }
    } catch {
      alert("Withdrawal failed");
    }
    setWithdrawing(false);
  };

  // Ensure valid JWT, signing if needed
  async function ensureAuth(): Promise<string | null> {
    let token = getToken();
    if (token && !isTokenExpired(token)) return token;
    if (!signMessage || !publicKey) return null;
    try {
      const message = `Sign in to JetForge
Wallet: ${publicKey.toBase58()}
Timestamp: ${Date.now()}`;
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await signMessage(msgBytes);
      // bs58 encode the signature
      const bs58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      function encodeBase58(buffer: Uint8Array): string {
        let digits = [0];
        for (let i = 0; i < buffer.length; i++) {
          let carry = buffer[i];
          for (let j = 0; j < digits.length; j++) {
            carry += digits[j] << 8;
            digits[j] = carry % 58;
            carry = (carry / 58) | 0;
          }
          while (carry > 0) {
            digits.push(carry % 58);
            carry = (carry / 58) | 0;
          }
        }
        let result = "";
        for (let i = 0; i < buffer.length && buffer[i] === 0; i++) result += "1";
        for (let i = digits.length - 1; i >= 0; i--) result += bs58Chars[digits[i]];
        return result;
      }
      const signature = encodeBase58(sigBytes);
      const resp = await fetch(`${API_BASE}/api/auth/wallet-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58(), signature, message }),
      });
      const data = await resp.json();
      if (data.token) {
        setToken(data.token);
        return data.token;
      }
    } catch (e) {
      console.error("Auth error:", e);
    }
    return null;
  }

  // Edit profile
  const openEdit = () => {
    setEditForm({
      displayName: profile?.displayName || "",
      bio: profile?.bio || "",
      twitterUrl: profile?.twitterUrl || "",
      websiteUrl: profile?.websiteUrl || "",
    });
    setEditError("");
    setEditOpen(true);
  };

  const saveProfile = async () => {
    setEditSaving(true);
    setEditError("");
    try {
      const token = await ensureAuth();
      if (!token) { setEditError("Could not authenticate wallet"); return; }
      const resp = await fetch(`${API_BASE}/api/creators/${wallet}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      const data = await resp.json();
      if (resp.ok) {
        setProfile((prev: any) => ({ ...prev, ...data }));
        setEditOpen(false);
      } else {
        setEditError(data.error || "Save failed");
      }
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    try {
      const token = await ensureAuth();
      if (!token) { setEditError("Could not authenticate wallet"); return; }
      // Upload image file first
      const formData = new FormData();
      formData.append("image", file);
      const uploadResp = await fetch(`${API_BASE}/api/upload/image`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadResp.json();
      if (!uploadResp.ok) { setEditError(uploadData.error || "Upload failed"); return; }
      const avatarUrl = uploadData.url || uploadData.imageUrl;
      if (!avatarUrl) { setEditError("No URL returned from upload"); return; }
      // Update avatar
      const resp = await fetch(`${API_BASE}/api/creators/${wallet}/avatar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarUrl }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setProfile((prev: any) => ({ ...prev, avatarUrl: data.avatarUrl }));
      } else {
        setEditError(data.error || "Avatar update failed");
      }
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const submitPost = async () => {
    if (!postContent.trim()) return;
    setPostSubmitting(true);
    setPostError("");
    try {
      const token = await ensureAuth();
      if (!token) { setPostError("Could not authenticate wallet"); return; }
      const resp = await fetch(`${API_BASE}/api/creators/${wallet}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: postContent }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setPosts((prev) => [data, ...prev]);
        setPostContent("");
      } else {
        setPostError(data.error || "Post failed");
      }
    } catch (e: any) {
      setPostError(e.message);
    } finally {
      setPostSubmitting(false);
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const token = await ensureAuth();
      if (!token) return;
      const resp = await fetch(`${API_BASE}/api/creators/${wallet}/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch {}
  };

  const toggleFollow = async () => {
    if (!viewer) return;
    try {
      const token = await ensureAuth();
      if (!token) return;
      const resp = await fetch(`${API_BASE}/api/creators/${wallet}/follow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (resp.ok) {
        setFollowData((prev) => ({
          ...prev,
          following: data.following,
          followerCount: prev.followerCount + (data.following ? 1 : -1),
        }));
      }
    } catch {}
  };

  // Copy wallet address
  const [copied, setCopied] = useState(false);
  const copyWallet = () => {
    navigator.clipboard.writeText(wallet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (creatorLoading || profileLoading) {
    return (
      <div className="max-w-[900px] mx-auto py-10 px-4 space-y-4 animate-pulse">
        <div className="h-32 bg-[#111] rounded-xl" />
        <div className="h-48 bg-[#111] rounded-xl" />
      </div>
    );
  }

  if (creatorError || !creator) return notFound();

  return (
    <div className="max-w-[900px] mx-auto py-10 px-4 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#555]">
        <Link href="/creators" className="hover:text-[#888] transition-colors">Creators</Link>
        <span>/</span>
        <span className="text-[#888]">{truncateAddress(wallet, 6)}</span>
      </div>

      {/* Creator header card */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <Avatar avatarUrl={profile?.avatarUrl} wallet={wallet} size={72} />
              {isOwn && (
                <button
                  onClick={openEdit}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#00ff88] rounded-full flex items-center justify-center text-black text-xs font-bold hover:bg-[#00dd77] transition-colors"
                  title="Edit profile"
                >
                  ✎
                </button>
              )}
            </div>

            <div>
              {/* Display name or wallet */}
              <div className="flex items-center gap-2">
                <div className="text-white font-bold text-lg">
                  {profile?.displayName || truncateAddress(wallet, 8)}
                </div>
                {isOwn && !profile?.displayName && (
                  <button onClick={openEdit} className="text-[#00ff88] text-xs hover:underline">+ Set name</button>
                )}
              </div>
              {/* Full wallet with copy */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[#555] font-mono text-xs">{wallet}</span>
                <button
                  onClick={copyWallet}
                  className="text-[#444] hover:text-[#888] transition-colors text-[10px]"
                  title="Copy address"
                >
                  {copied ? "✓" : "⧉"}
                </button>
              </div>
              {/* Bio */}
              {profile?.bio && (
                <div className="text-[#888] text-xs mt-1.5 max-w-xs">{profile.bio}</div>
              )}
              {/* Links */}
              <div className="flex items-center gap-3 mt-1.5">
                {profile?.twitterUrl && (
                  <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-[#1DA1F2] text-xs hover:underline">
                    Twitter
                  </a>
                )}
                {profile?.websiteUrl && (
                  <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-[#00ff88] text-xs hover:underline">
                    Website
                  </a>
                )}
              </div>
              {/* Badge */}
              <div className="mt-2">
                <ReputationBadge badge={creator.badge} label={creator.badgeLabel} color={creator.badgeColor} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Follower stats */}
            <div className="flex items-center gap-3 text-xs text-[#555] border border-[#1a1a1a] px-3 py-1.5 rounded-lg">
              <span><span className="text-white font-semibold">{followData.followerCount}</span> followers</span>
              <span className="text-[#2a2a2a]">·</span>
              <span><span className="text-white font-semibold">{followData.followingCount}</span> following</span>
            </div>
            {isOwn ? (
              <button
                onClick={openEdit}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444] transition-colors"
              >
                Edit Profile
              </button>
            ) : (
              <button
                onClick={toggleFollow}
                disabled={!viewer}
                title={!viewer ? "Connect wallet to follow" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                  !viewer
                    ? "border-[#2a2a2a] text-[#444] cursor-not-allowed bg-transparent"
                    : followData.following
                      ? "bg-[#00ff8815] border-[#00ff8840] text-[#00ff88] hover:bg-[#00ff8825]"
                      : "bg-[#00ff88] border-[#00ff88] text-black font-bold hover:bg-[#00dd77]"
                }`}
              >
                {!viewer ? "Connect to Follow" : followData.following ? "✓ Following" : "+ Follow"}
              </button>
            )}
            <Link
              href={`/portfolio/${wallet}`}
              className="text-xs text-[#555] hover:text-white border border-[#2a2a2a] px-3 py-1.5 rounded-md transition-colors"
            >
              Portfolio →
            </Link>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
          {[
            { label: "Tokens Launched", value: creator.tokensLaunched, accent: false, usd: null },
            { label: "Graduated", value: creator.graduatedTokens, accent: creator.graduatedTokens > 0, usd: null },
            {
              label: "Total Volume",
              value: `${parseFloat(creator.totalVolumeSol).toFixed(2)} SOL`,
              accent: false,
              usd: solToUsd(parseFloat(creator.totalVolumeSol), solPrice),
            },
          ].map((s) => (
            <div key={s.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
              <div className="text-[#555] text-xs mb-1">{s.label}</div>
              <div className={`font-mono font-semibold text-sm ${s.accent ? "text-[#00ff88]" : "text-white"}`}>
                {s.value}
              </div>
              {s.usd && <div className="text-[#444] text-[10px] mt-0.5">{s.usd}</div>}
            </div>
          ))}
        </div>

        {/* Earnings row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="bg-[#0d0d0d] border border-[#00ff8830] rounded-lg p-4">
            <div className="text-[#555] text-xs mb-1">All-Time Earnings</div>
            <div className="text-[#00ff88] font-mono font-bold text-xl">
              {parseFloat(creator.estimatedEarningsSol).toFixed(4)} SOL
            </div>
            {solToUsd(parseFloat(creator.estimatedEarningsSol), solPrice) && (
              <div className="text-[#00ff8880] text-xs mt-0.5">{solToUsd(parseFloat(creator.estimatedEarningsSol), solPrice)}</div>
            )}
            <div className="text-[#444] text-[10px] mt-1">
              0.4% of all trading volume on your tokens · cumulative total
            </div>
          </div>
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4">
            <div className="text-[#555] text-xs mb-1">Claimable Now</div>
            <div className="text-white font-mono font-bold text-xl">
              {parseFloat(creator.claimableEarningsSol ?? "0").toFixed(4)} SOL
            </div>
            {solToUsd(parseFloat(creator.claimableEarningsSol ?? "0"), solPrice) && (
              <div className="text-[#88888880] text-xs mt-0.5">{solToUsd(parseFloat(creator.claimableEarningsSol ?? "0"), solPrice)}</div>
            )}
            <div className="text-[#444] text-[10px] mt-1">
              Sitting in your on-chain vaults · withdraw from each token page
            </div>
          </div>
        </div>
      </div>

      {/* Referral Stats - public */}
      {referralStats.hasReferralAccount && (
        <div className="border border-[#1a2a1a] rounded-xl p-4">
          <h3 className="text-[#00ff88] font-semibold mb-3">Referral Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-gray-400 text-xs mb-1">All-time earnings</div>
              <div className="text-white font-mono font-bold">{referralStats.totalEarned.toFixed(4)} SOL</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Users referred</div>
              <div className="text-white font-bold">{referralStats.totalReferrals}</div>
            </div>
          </div>
        </div>
      )}

      {/* Referral Dashboard - owner only */}
      {isOwn && (
        <div className="border border-[#1a2a1a] rounded-xl p-4">
          <h3 className="text-[#00ff88] font-semibold mb-3">Your Referral Dashboard</h3>
          <div className="mb-3">
            <div className="text-gray-400 text-xs mb-1">Your referral link</div>
            <div className="flex items-center gap-2 bg-[#0f1f0f] rounded-lg p-2">
              <code className="text-[#00ff88] text-sm flex-1 truncate">
                {referralDashboard.referralLink || "Loading..."}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(referralDashboard.referralLink || ""); }}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 border border-[#1a2a1a] rounded"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-gray-400 text-xs mb-1">Pending balance</div>
              <div className="text-white font-mono font-bold text-lg">
                {(referralDashboard.pendingBalance || 0).toFixed(4)} SOL
              </div>
              <div className="text-gray-500 text-xs">Min. 0.1 SOL to withdraw</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">All-time earned</div>
              <div className="text-white font-mono font-bold text-lg">
                {(referralDashboard.totalEarned || 0).toFixed(4)} SOL
              </div>
            </div>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!referralDashboard.canWithdraw || withdrawing}
            className={`w-full py-2 rounded-lg font-semibold text-sm transition-all ${
              referralDashboard.canWithdraw
                ? "bg-[#00ff88] text-black hover:bg-[#00cc66]"
                : "bg-[#1a2a1a] text-gray-500 cursor-not-allowed"
            }`}
          >
            {withdrawing ? "Processing..." : `Withdraw ${(referralDashboard.pendingBalance || 0).toFixed(4)} SOL`}
          </button>
          {!referralDashboard.canWithdraw && (referralDashboard.pendingBalance || 0) < 0.1 && (
            <p className="text-gray-500 text-xs text-center mt-2">
              {(0.1 - (referralDashboard.pendingBalance || 0)).toFixed(4)} SOL more needed to withdraw
            </p>
          )}
        </div>
      )}

      {/* Posts section */}
      <div>
        <div className="text-white font-semibold text-sm mb-3">Posts</div>

        {/* Compose (own profile) */}
        {isOwn && (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 mb-4">
            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="Write a post..."
              maxLength={500}
              rows={3}
              className="w-full bg-transparent text-white text-sm resize-none outline-none placeholder:text-[#444] border-b border-[#1a1a1a] pb-2 mb-3"
            />
            <div className="flex items-center justify-between">
              <span className="text-[#444] text-xs">{postContent.length}/500</span>
              <div className="flex items-center gap-2">
                {postError && <span className="text-red-400 text-xs">{postError}</span>}
                <button
                  onClick={submitPost}
                  disabled={postSubmitting || !postContent.trim()}
                  className="px-4 py-1.5 bg-[#00ff88] text-black text-xs font-bold rounded-lg hover:bg-[#00dd77] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {postSubmitting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Posts feed */}
        {postsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-[#111] border border-[#1a1a1a] rounded-xl animate-pulse" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-8 text-center text-[#444] text-sm">
            No posts yet
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar avatarUrl={profile?.avatarUrl} wallet={wallet} size={28} />
                    <span className="text-white text-xs font-semibold">{profile?.displayName || truncateAddress(wallet, 6)}</span>
                    <span className="text-[#444] text-xs">{timeAgo(post.createdAt)}</span>
                  </div>
                  {isOwn && (
                    <button
                      onClick={() => deletePost(post.id)}
                      className="text-[#444] hover:text-red-400 text-xs transition-colors flex-shrink-0"
                      title="Delete post"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-[#ccc] text-sm whitespace-pre-wrap">{post.content}</p>
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="Post image" className="mt-3 rounded-lg max-h-64 object-cover" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tokens launched */}
      <div>
        <div className="text-white font-semibold text-sm mb-3">Tokens Launched</div>
        {creator.tokens.length === 0 ? (
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-8 text-center text-[#444] text-sm">
            No tokens launched yet
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden space-y-2">
              {creator.tokens.map((token: any) => (
                <Link
                  key={token.mint}
                  href={`/token/${token.mint}`}
                  className="flex items-center gap-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-3 hover:border-[#2a2a2a] transition-colors"
                >
                  {resolveImageUrl(token.imageUrl) ? (
                    <img loading="lazy" decoding="async" src={resolveImageUrl(token.imageUrl)!} alt={token.symbol} width={40} height={40} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-sm font-bold text-[#555] flex-shrink-0">
                      {token.symbol?.[0] ?? "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-sm font-semibold truncate">{token.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[#555] text-[10px] font-mono">${token.symbol}</span>
                      <span className="text-[#333] text-[10px]">·</span>
                      <span className="text-[#555] text-[10px]">{timeAgo(token.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[#666] text-[10px]">
                        {parseFloat(token.realSolReserves).toFixed(2)} SOL raised
                        {solToUsd(parseFloat(token.realSolReserves), solPrice) && (
                          <span className="text-[#444] ml-1">({solToUsd(parseFloat(token.realSolReserves), solPrice)})</span>
                        )}
                      </span>
                      <span className="text-[#333] text-[10px]">·</span>
                      <span className="text-[#666] text-[10px]">{token.trades} trades</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {token.isGraduated ? (
                      <span className="px-1.5 py-0.5 bg-[#00ff8820] border border-[#00ff8840] rounded text-[#00ff88] text-[10px] font-semibold">GRAD</span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#555] text-[10px]">LIVE</span>
                    )}
                    {parseFloat(token.claimableEarnings) > 0 && (
                      <div className="text-[#00ff88] text-[10px] font-mono mt-1">
                        {parseFloat(token.claimableEarnings).toFixed(3)} SOL
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto rounded-xl">
              <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden min-w-[400px]">
                <div className="grid grid-cols-[1fr_80px_60px_80px_55px] gap-2 px-4 py-2.5 border-b border-[#1a1a1a] text-[#444] text-xs uppercase tracking-wider">
                  <div>Token</div>
                  <div className="text-right">Raised</div>
                  <div className="text-right">Trades</div>
                  <div className="text-right">Claimable</div>
                  <div className="text-right">Status</div>
                </div>
                {creator.tokens.map((token: any) => (
                  <Link
                    key={token.mint}
                    href={`/token/${token.mint}`}
                    className="grid grid-cols-[1fr_80px_60px_80px_55px] gap-2 px-4 py-3 border-b border-[#111] last:border-0 hover:bg-[#111] transition-colors items-center"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {resolveImageUrl(token.imageUrl) ? (
                        <img loading="lazy" decoding="async" src={resolveImageUrl(token.imageUrl)!} alt={token.symbol} width={32} height={32} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-xs text-[#555] flex-shrink-0">
                          {token.symbol?.[0] ?? "?"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-white text-xs font-semibold truncate">{token.name}</div>
                        <div className="text-[#555] text-[10px]">{timeAgo(token.createdAt)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div>
                        <span className="text-[#888] text-xs">{parseFloat(token.realSolReserves).toFixed(2)}</span>
                        <span className="text-[#555] text-[10px] ml-0.5">SOL</span>
                      </div>
                      {solToUsd(parseFloat(token.realSolReserves), solPrice) && (
                        <div className="text-[#444] text-[10px]">{solToUsd(parseFloat(token.realSolReserves), solPrice)}</div>
                      )}
                    </div>
                    <div className="text-right text-[#666] text-xs">{token.trades}</div>
                    <div className="text-right">
                      {parseFloat(token.claimableEarnings) > 0 ? (
                        <>
                          <div className="text-[#00ff88] text-xs font-mono">{parseFloat(token.claimableEarnings).toFixed(4)}</div>
                          {solToUsd(parseFloat(token.claimableEarnings), solPrice) && (
                            <div className="text-[#444] text-[10px]">{solToUsd(parseFloat(token.claimableEarnings), solPrice)}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-[#333] text-xs">—</span>
                      )}
                    </div>
                    <div className="flex justify-end">
                      {token.isGraduated ? (
                        <span className="px-1.5 py-0.5 bg-[#00ff8820] border border-[#00ff8840] rounded text-[#00ff88] text-[10px]">GRAD</span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#555] text-[10px]">LIVE</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative bg-[#111] border border-[#1a2a1a] rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">Edit Profile</h2>
              <button onClick={() => setEditOpen(false)} className="text-[#555] hover:text-white transition-colors text-xl">✕</button>
            </div>

            {/* Avatar upload */}
            <div className="flex items-center gap-4 mb-5">
              <Avatar avatarUrl={profile?.avatarUrl} wallet={wallet} size={56} />
              <div>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="text-xs text-[#00ff88] hover:underline disabled:opacity-50"
                >
                  {avatarUploading ? "Uploading..." : "Change avatar"}
                </button>
                <p className="text-[#444] text-[10px] mt-0.5">JPG, PNG, GIF up to 5MB</p>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAvatar(file);
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[#555] text-xs block mb-1.5">Display Name <span className="text-[#333]">(30 chars max)</span></label>
                <input
                  type="text"
                  maxLength={30}
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="Your name"
                  className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#00ff8840] transition-colors"
                />
              </div>

              <div>
                <label className="text-[#555] text-xs block mb-1.5">Bio <span className="text-[#333]">(160 chars max)</span></label>
                <textarea
                  maxLength={160}
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Tell people about yourself..."
                  className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#00ff8840] transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-[#555] text-xs block mb-1.5">Twitter URL</label>
                <input
                  type="url"
                  value={editForm.twitterUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, twitterUrl: e.target.value }))}
                  placeholder="https://twitter.com/yourhandle"
                  className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#00ff8840] transition-colors"
                />
              </div>

              <div>
                <label className="text-[#555] text-xs block mb-1.5">Website URL</label>
                <input
                  type="url"
                  value={editForm.websiteUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder="https://yoursite.com"
                  className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#00ff8840] transition-colors"
                />
              </div>
            </div>

            {editError && <p className="text-red-400 text-xs mt-3">{editError}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 py-2 border border-[#2a2a2a] text-[#888] text-sm rounded-lg hover:text-white hover:border-[#444] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={editSaving}
                className="flex-1 py-2 bg-[#00ff88] text-black text-sm font-bold rounded-lg hover:bg-[#00dd77] disabled:opacity-50 transition-colors"
              >
                {editSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
