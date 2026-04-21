"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { getComments, postComment, buildCommentMessage, truncateAddress, CommentData } from "@/lib/api";
import bs58 from "bs58";
import { useSocket } from "@/hooks/useLiveFeed";
import { clsx } from "clsx";

interface TokenCommentsProps {
  mint: string;
  progress?: number;   // 0–100 bonding curve %
  totalTrades?: number;
}

interface SystemMessage {
  id: string;
  isSystem: true;
  icon: string;
  text: string;
}

type DisplayComment = CommentData | SystemMessage;

function buildSystemMessages(progress: number, totalTrades: number): SystemMessage[] {
  const msgs: SystemMessage[] = [];

  if (progress >= 100) {
    msgs.push({ id: "sys-graduated", isSystem: true, icon: "🎓", text: "This token has graduated to the DEX! Trading now live on Raydium." });
  } else if (progress >= 85) {
    msgs.push({ id: "sys-final", isSystem: true, icon: "🚀", text: `Bonding curve is ${progress.toFixed(0)}% full — final push to the DEX! Buy now before graduation.` });
  } else if (progress >= 50) {
    msgs.push({ id: "sys-halfway", isSystem: true, icon: "🔥", text: `Halfway there! Curve is ${progress.toFixed(0)}% full and building strong momentum.` });
  } else if (progress >= 25) {
    msgs.push({ id: "sys-building", isSystem: true, icon: "📈", text: `Curve at ${progress.toFixed(0)}% — community is building liquidity. Early movers still have room.` });
  }

  if (totalTrades >= 100) {
    msgs.push({ id: "sys-100trades", isSystem: true, icon: "💯", text: `${totalTrades} trades completed! This token has an active community.` });
  } else if (totalTrades >= 50) {
    msgs.push({ id: "sys-50trades", isSystem: true, icon: "⚡", text: `${totalTrades} trades in — momentum is building fast.` });
  } else if (totalTrades >= 10) {
    msgs.push({ id: "sys-10trades", isSystem: true, icon: "✅", text: `${totalTrades} trades completed — this token is getting traction.` });
  }

  return msgs;
}

export function TokenComments({ mint, progress = 0, totalTrades = 0 }: TokenCommentsProps) {
  const { publicKey, signMessage } = useWallet();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["comments", mint],
    queryFn: () => getComments(mint),
    staleTime: 30_000,
  });

  const comments = data?.comments ?? [];

  // Listen for new comments via WebSocket
  useEffect(() => {
    if (!socket || !mint) return;
    socket.on("new_comment", (comment: CommentData) => {
      if (comment.mint !== mint) return;
      queryClient.setQueryData(["comments", mint], (old: any) => ({
        comments: [...(old?.comments ?? []), comment],
      }));
    });
    return () => { socket.off("new_comment"); };
  }, [socket, mint, queryClient]);

  const handlePost = async () => {
    if (!publicKey || !signMessage || !text.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const message = buildCommentMessage(mint, text.trim());
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await signMessage(msgBytes);
      const signature = bs58.encode(sigBytes);
      await postComment(mint, publicKey.toBase58(), text.trim(), signature, message);
      setText("");
      queryClient.invalidateQueries({ queryKey: ["comments", mint] });
    } catch (e: any) {
      setError(e?.message ?? "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const systemMessages = buildSystemMessages(progress, totalTrades);

  // Interleave: system messages first (as pinned context), then user comments
  const displayItems: DisplayComment[] = [...systemMessages, ...comments];

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <span className="text-white text-sm font-semibold">💬 Comments</span>
        <span className="text-[#555] text-xs">{comments.length}</span>
      </div>

      {/* Comments list */}
      <div className="overflow-y-auto max-h-[320px] p-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-[#1a1a1a] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-[#333]">
            <div className="text-3xl mb-2">💬</div>
            <div className="text-sm">No comments yet — be the first!</div>
          </div>
        ) : (
          displayItems.map((item) => {
            if ("isSystem" in item) {
              return (
                <div key={item.id} className="flex gap-2.5 animate-slide-in">
                  <div className="w-7 h-7 rounded-full bg-[#00ff8815] border border-[#00ff8830] flex items-center justify-center text-sm shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0 bg-[#00ff8808] border border-[#00ff8818] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[#00ff88] text-[10px] font-semibold">System</span>
                      <span className="text-[#333] text-[10px]">auto</span>
                    </div>
                    <p className="text-[#8dffc9] text-xs break-words">{item.text}</p>
                  </div>
                </div>
              );
            }

            const c = item as CommentData;
            return (
              <div key={c.id} className="flex gap-2.5 animate-slide-in">
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[10px] text-[#555] font-mono shrink-0">
                  {c.wallet.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0 bg-[#0d0d0d] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[#555] text-[10px] font-mono">{truncateAddress(c.wallet, 4)}</span>
                    <span className="text-[#333] text-[10px]">
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[#aaa] text-xs break-words">{c.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-[#1a1a1a]">
        {!publicKey ? (
          <div className="text-center text-[#555] text-xs py-2">Connect wallet to comment</div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 280))}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handlePost()}
              placeholder="Say something..."
              className="flex-1 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-[#333]"
            />
            <button
              onClick={handlePost}
              disabled={posting || !text.trim()}
              className={clsx(
                "px-3 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0",
                "bg-[#00ff8820] text-[#00ff88] hover:bg-[#00ff8830] disabled:opacity-40 disabled:cursor-not-allowed border border-[#00ff8830]"
              )}
            >
              {posting ? "..." : "Post"}
            </button>
          </div>
        )}
        {error && <div className="text-[#ff4444] text-[10px] mt-1">{error}</div>}
        {text.length > 240 && (
          <div className="text-[#555] text-[10px] mt-1">{280 - text.length} characters left</div>
        )}
      </div>
    </div>
  );
}
