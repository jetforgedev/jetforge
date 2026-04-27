import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "JetForge — Fair-Launch Token Platform on Solana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const logoSrc = await fetch(
    new URL("/brand/jetforge-mark.svg", "https://app.jetforge.io").toString()
  )
    .then((r) => r.text())
    .then((svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`)
    .catch(() => null);

  const stats = [
    { icon: "🚀", label: "Launch a Token", value: "Under 30 sec",  color: "#00ff88" },
    { icon: "📈", label: "Bonding Curve",   value: "xy=k AMM",      color: "#00ccff" },
    { icon: "🎓", label: "Auto-Graduation", value: "→ Raydium DEX", color: "#a78bfa" },
    { icon: "💰", label: "Creator Reward",  value: "5% on Grad",    color: "#ffaa00" },
  ];

  const tokens = [
    { symbol: "PEPE2", name: "Pepe 2.0",    pct: 94, color: "#ff6b6b" },
    { symbol: "MOON",  name: "MoonShot",    pct: 67, color: "#ffaa00" },
    { symbol: "DOGE3", name: "Doge The 3rd", pct: 38, color: "#00ccff" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "#07110f",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* ── Background glows ── */}
        <div style={{
          position: "absolute", top: "-160px", left: "-80px",
          width: "700px", height: "700px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,255,136,0.13) 0%, transparent 65%)",
          display: "flex",
        }} />
        <div style={{
          position: "absolute", bottom: "-120px", right: "340px",
          width: "500px", height: "500px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,204,255,0.09) 0%, transparent 65%)",
          display: "flex",
        }} />
        <div style={{
          position: "absolute", top: "80px", right: "-60px",
          width: "420px", height: "420px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 65%)",
          display: "flex",
        }} />

        {/* ── Vertical divider ── */}
        <div style={{
          position: "absolute", left: "580px", top: "40px", bottom: "40px",
          width: "1px",
          background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent)",
          display: "flex",
        }} />

        {/* ══════════ LEFT COLUMN ══════════ */}
        <div style={{
          width: "580px", display: "flex", flexDirection: "column",
          padding: "52px 50px 44px 56px", justifyContent: "space-between",
        }}>

          {/* Top: logo + name + badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} width={44} height={44} alt="" style={{ objectFit: "contain" }} />
            ) : (
              <div style={{ fontSize: "36px", display: "flex" }}>🚀</div>
            )}
            <span style={{ fontSize: "26px", fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
              <span style={{ color: "#00ff88" }}>Jet</span>Forge
            </span>
            <div style={{
              marginLeft: "4px",
              padding: "4px 12px", borderRadius: "999px",
              background: "rgba(0,255,136,0.12)", border: "1px solid rgba(0,255,136,0.30)",
              color: "#00ff88", fontSize: "11px", fontWeight: 700,
              letterSpacing: "0.12em", display: "flex",
            }}>
              DEVNET BETA
            </div>
          </div>

          {/* Centre: headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{
              fontSize: "54px", fontWeight: 900, color: "#ffffff",
              lineHeight: 1.08, letterSpacing: "-1.5px", display: "flex",
              flexDirection: "column",
            }}>
              <span>Fair-Launch</span>
              <span>Token Platform</span>
              <span style={{ color: "#00ff88" }}>on Solana.</span>
            </div>
            <div style={{
              fontSize: "17px", color: "rgba(255,255,255,0.48)",
              lineHeight: 1.55, display: "flex", maxWidth: "420px",
            }}>
              No presales. No team allocations. Every token starts on a bonding curve and graduates to Raydium automatically.
            </div>
          </div>

          {/* Bottom: pills + CTA */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {["🔒 No Presales", "📊 Bonding Curve AMM", "🎓 Auto-grad to DEX"].map((t) => (
                <div key={t} style={{
                  padding: "7px 16px", borderRadius: "999px",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.65)", fontSize: "14px", fontWeight: 500,
                  display: "flex",
                }}>
                  {t}
                </div>
              ))}
            </div>
            {/* CTA button */}
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              <div style={{
                padding: "13px 28px", borderRadius: "14px",
                background: "linear-gradient(135deg, #00ff88, #00cc77)",
                color: "#04110c", fontSize: "17px", fontWeight: 800,
                letterSpacing: "-0.2px", display: "flex",
              }}>
                Launch Your Token →
              </div>
              <div style={{
                padding: "13px 22px", borderRadius: "14px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.70)", fontSize: "17px", fontWeight: 600,
                display: "flex",
              }}>
                Start Trading
              </div>
            </div>
          </div>
        </div>

        {/* ══════════ RIGHT COLUMN ══════════ */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          padding: "44px 44px 44px 38px", gap: "14px",
        }}>

          {/* Stat cards */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "4px" }}>
            {stats.map((s) => (
              <div key={s.label} style={{
                flex: 1, display: "flex", flexDirection: "column",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px", padding: "14px 16px", gap: "6px",
              }}>
                <div style={{ fontSize: "22px", display: "flex" }}>{s.icon}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.38)", letterSpacing: "0.06em", display: "flex" }}>
                  {s.label.toUpperCase()}
                </div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: s.color, display: "flex" }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Live tokens panel */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px", overflow: "hidden",
          }}>
            {/* Panel header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: "#00ff88",
                  boxShadow: "0 0 8px rgba(0,255,136,0.8)",
                  display: "flex",
                }} />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", display: "flex" }}>
                  TRENDING TOKENS
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", display: "flex" }}>app.jetforge.io</span>
            </div>

            {/* Token rows */}
            <div style={{ display: "flex", flexDirection: "column", padding: "6px 0" }}>
              {tokens.map((tk, i) => (
                <div key={tk.symbol} style={{
                  display: "flex", alignItems: "center",
                  padding: "10px 18px", gap: "14px",
                  background: i === 0 ? "rgba(255,255,255,0.025)" : "transparent",
                }}>
                  {/* Color dot */}
                  <div style={{
                    width: "34px", height: "34px", borderRadius: "50%",
                    background: `${tk.color}22`, border: `1.5px solid ${tk.color}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", color: tk.color, fontWeight: 800,
                    flexShrink: 0,
                  }}>
                    {tk.symbol[0]}
                  </div>

                  {/* Name + symbol */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff", display: "flex" }}>{tk.name}</span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", display: "flex" }}>${tk.symbol}</span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px", width: "110px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: tk.color, display: "flex" }}>
                      {tk.pct}% filled
                    </span>
                    <div style={{
                      width: "110px", height: "5px", borderRadius: "999px",
                      background: "rgba(255,255,255,0.08)", display: "flex", overflow: "hidden",
                    }}>
                      <div style={{
                        width: `${tk.pct}%`, height: "100%",
                        background: tk.color, borderRadius: "999px", display: "flex",
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
