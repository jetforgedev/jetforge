import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
        }}
      >
        {/* Rocket body */}
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 2 C11 2 16 6 16 12 L11 20 L6 12 C6 6 11 2 11 2Z" fill="#00ff88" />
          <circle cx="11" cy="10" r="2.5" fill="#0a0a0a" />
          <path d="M6 12 L3 15 L6 14Z" fill="#00cc66" />
          <path d="M16 12 L19 15 L16 14Z" fill="#00cc66" />
          <path d="M9 18 L11 22 L13 18Z" fill="#ff6600" opacity="0.9" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
