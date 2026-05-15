import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const API_URL = "https://api.jetforge.io/api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get("mint");

  // Default OG for homepage / no mint
  if (!mint) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "1200px",
            height: "630px",
            background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "24px",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "40px",
              }}
            >
              🚀
            </div>
            <span style={{ color: "#ffffff", fontSize: "64px", fontWeight: "800", letterSpacing: "-2px" }}>
              JetForge
            </span>
          </div>
          <p style={{ color: "#9ca3af", fontSize: "28px", margin: "0", textAlign: "center", maxWidth: "700px" }}>
            Fair-launch token launchpad on Solana
          </p>
          <div style={{ display: "flex", gap: "32px", marginTop: "8px" }}>
            {["No Presales", "No Team Alloc", "Raydium Graduation"].map((label) => (
              <div
                key={label}
                style={{
                  background: "rgba(99,102,241,0.2)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  borderRadius: "8px",
                  padding: "8px 20px",
                  color: "#a5b4fc",
                  fontSize: "18px",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Token-specific OG
  let token: {
    name?: string;
    symbol?: string;
    description?: string;
    imageUrl?: string;
    marketCapSol?: number;
    graduationProgress?: number;
    isGraduated?: boolean;
    priceUsd?: number;
  } | null = null;

  try {
    const res = await fetch(`${API_URL}/tokens/${mint}`, {
      headers: { "User-Agent": "JetForge-OG/1.0" },
    });
    if (res.ok) token = await res.json();
  } catch {}

  const name = token?.name ?? "Unknown Token";
  const symbol = token?.symbol ?? "???";
  const mcSol = token?.marketCapSol ? Number(token.marketCapSol).toFixed(2) : "0.00";
  const progress = token?.graduationProgress ? Math.min(100, Number(token.graduationProgress)).toFixed(1) : "0.0";
  const graduated = token?.isGraduated ?? false;
  const desc = token?.description
    ? token.description.slice(0, 100) + (token.description.length > 100 ? "…" : "")
    : `Trade ${symbol} on JetForge`;

  const progressBarWidth = Math.min(100, Number(progress)) * 6; // 600px max bar

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 60%, #0f0f1a 100%)",
          padding: "48px 56px",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header: token identity */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {token?.imageUrl ? (
            <img
              src={token.imageUrl}
              width={100}
              height={100}
              style={{ borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(99,102,241,0.5)" }}
            />
          ) : (
            <div
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "48px",
              }}
            >
              🪙
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
              <span style={{ color: "#ffffff", fontSize: "52px", fontWeight: "800", lineHeight: "1" }}>
                {name}
              </span>
              <span style={{ color: "#6366f1", fontSize: "28px", fontWeight: "600" }}>
                ${symbol}
              </span>
            </div>
            <span style={{ color: "#9ca3af", fontSize: "22px" }}>{desc}</span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "24px" }}>
          {[
            { label: "Market Cap", value: `${mcSol} SOL` },
            { label: "Status", value: graduated ? "✅ Graduated to Raydium" : `🔥 ${progress}% to graduation` },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <span style={{ color: "#6b7280", fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {label}
              </span>
              <span style={{ color: "#ffffff", fontSize: "26px", fontWeight: "700" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Graduation progress bar */}
        {!graduated && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9ca3af", fontSize: "16px" }}>Bonding curve progress</span>
              <span style={{ color: "#a5b4fc", fontSize: "16px" }}>{progress}% / 85 SOL</span>
            </div>
            <div
              style={{
                width: "100%",
                height: "10px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "99px",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                  borderRadius: "99px",
                }}
              />
            </div>
          </div>
        )}

        {/* Footer branding */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#6366f1", fontSize: "24px", fontWeight: "700" }}>🚀 JetForge</span>
          <span style={{ color: "#4b5563", fontSize: "18px" }}>app.jetforge.io/token/{mint?.slice(0, 8)}…</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
