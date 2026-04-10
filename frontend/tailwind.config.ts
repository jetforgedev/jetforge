import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#111111",
        "surface-2": "#1a1a1a",
        "surface-3": "#222222",
        border: "#2a2a2a",
        "border-2": "#333333",
        primary: "#00ff88",
        "primary-dark": "#00cc6a",
        "primary-dim": "#00ff8820",
        accent: "#7c3aed",
        "accent-dim": "#7c3aed20",
        green: "#00ff88",
        "green-dim": "#00ff8815",
        red: "#ff4444",
        "red-dim": "#ff444415",
        yellow: "#ffcc00",
        "text-primary": "#ffffff",
        "text-secondary": "#888888",
        "text-muted": "#555555",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "flash-green": "flashGreen 0.5s ease-out",
        "flash-red": "flashRed 0.5s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "shimmer": "shimmer 2.2s linear infinite",
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        ticker: "ticker 20s linear infinite",
      },
      keyframes: {
        flashGreen: {
          "0%": { backgroundColor: "#00ff8840" },
          "100%": { backgroundColor: "transparent" },
        },
        flashRed: {
          "0%": { backgroundColor: "#ff444440" },
          "100%": { backgroundColor: "transparent" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 rgba(0,255,136,0)" },
          "50%": { boxShadow: "0 0 28px rgba(0,255,136,0.22), 0 0 64px rgba(0,255,136,0.08)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 0 1px rgba(255,207,90,0.16), 0 0 26px rgba(255,207,90,0.05)" },
          "50%": { boxShadow: "0 0 0 1px rgba(255,207,90,0.45), 0 0 32px rgba(255,207,90,0.22)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        slideIn: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-green":
          "linear-gradient(135deg, #00ff8820 0%, transparent 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
