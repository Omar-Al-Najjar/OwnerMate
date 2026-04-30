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
        surface: "hsl(var(--surface-low))",
        card: "hsl(var(--surface-lowest))",
        "surface-low": "hsl(var(--surface-low))",
        "surface-lowest": "hsl(var(--surface-lowest))",
        "surface-high": "hsl(var(--surface-high))",
        "surface-highest": "hsl(var(--surface-highest))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        border: "hsl(var(--border))",
        primary: "hsl(var(--primary))",
        "primary-hover": "hsl(var(--primary-hover))",
        "primary-container": "hsl(var(--primary-container))",
        "surface-tint": "hsl(var(--surface-tint))",
        sidebar: "hsl(var(--sidebar))",
        "sidebar-foreground": "hsl(var(--sidebar-foreground))",
        "sidebar-muted": "hsl(var(--sidebar-muted))",
        "sidebar-surface": "hsl(var(--sidebar-surface))",
        "sidebar-surface-hover": "hsl(var(--sidebar-surface-hover))",
        "sidebar-border": "hsl(var(--sidebar-border))",
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
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        ui: ["var(--font-ui)", "ui-sans-serif", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "Tahoma", "Arial", "sans-serif"],
        display: [
          "var(--font-heading)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.625rem",
        lg: "0.75rem",
        xl: "0.75rem",
        "2xl": "0.75rem",
        "3xl": "0.75rem",
      },
      boxShadow: {
        panel:
          "0 1px 0 rgba(21, 27, 45, 0.08), 0 18px 40px -28px rgba(21, 27, 45, 0.18)",
        float:
          "0 1px 0 rgba(21, 27, 45, 0.12), 0 24px 52px -30px rgba(21, 27, 45, 0.24)",
      },
    },
  },
  plugins: [],
};

export default config;
