import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "JetForge — Fair-Launch Token Platform on Solana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  // Fetch the brand mark so next/og can embed it
  const logoSrc = await fetch(
    new URL("/brand/jetforge-mark.png", "https://app.jetforge.io").toString()
  )
    .then((r) => r.arrayBuffer())
    .catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#07110f",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Radial glow — top centre */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "900px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(0,255,136,0.18) 0%, rgba(0,204,255,0.08) 40%, transparent 70%)",
          }}
        />

        {/* Bottom-right accent */}
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            right: "-80px",
            width: "420px",
            height: "420px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)",
          }}
        />

        {/* Logo mark */}
        <div style={{ display: "flex", marginBottom: "24px" }}>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${Buffer.from(logoSrc).toString("base64")}`}
              width={96}
              height={96}
              alt="JetForge logo"
              style={{ objectFit: "contain" }}
            />
          ) : (
            <div style={{ fontSize: "80px", lineHeight: 1, display: "flex" }}>🚀</div>
          )}
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: "80px",
            fontWeight: 800,
            letterSpacing: "-2px",
            color: "#ffffff",
            display: "flex",
            gap: "0px",
            lineHeight: 1,
            marginBottom: "20px",
          }}
        >
          <span style={{ color: "#00ff88" }}>Jet</span>
          <span>Forge</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "28px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.58)",
            letterSpacing: "0.02em",
            display: "flex",
            marginBottom: "40px",
          }}
        >
          Fair-Launch Token Platform on Solana
        </div>

        {/* Pill badges */}
        <div style={{ display: "flex", gap: "14px" }}>
          {["No Presales", "Bonding Curve AMM", "Auto-grad to Raydium"].map((label) => (
            <div
              key={label}
              style={{
                padding: "10px 22px",
                borderRadius: "999px",
                border: "1px solid rgba(0,255,136,0.25)",
                background: "rgba(0,255,136,0.08)",
                color: "rgba(255,255,255,0.72)",
                fontSize: "18px",
                fontWeight: 500,
                display: "flex",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Domain watermark */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            right: "40px",
            fontSize: "16px",
            color: "rgba(255,255,255,0.22)",
            fontWeight: 500,
            letterSpacing: "0.04em",
            display: "flex",
          }}
        >
          app.jetforge.io
        </div>
      </div>
    ),
    { ...size },
  );
}
