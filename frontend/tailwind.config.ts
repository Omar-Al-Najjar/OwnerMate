import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        surface: "hsl(var(--surface))",
        card: "hsl(var(--card))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        border: "hsl(var(--border))",
        primary: "hsl(var(--primary))",
        "primary-hover": "hsl(var(--primary-hover))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        error: "hsl(var(--error))",
        sentiment: {
          positive: "hsl(var(--sentiment-positive))",
          neutral: "hsl(var(--sentiment-neutral))",
          negative: "hsl(var(--sentiment-negative))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        arabic: ["var(--font-arabic)"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px 0 rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
