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
        board: "hsl(var(--board))",
        paper: "hsl(var(--paper))",
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
        "primary-foreground": "hsl(var(--primary-foreground))",
        "primary-hover": "hsl(var(--primary-hover))",
        "primary-container": "hsl(var(--primary-container))",
        "surface-tint": "hsl(var(--surface-tint))",
        ink: "hsl(var(--ink))",
        "text-main": "hsl(var(--text-main))",
        "text-muted": "hsl(var(--muted))",
        "text-subtle": "hsl(var(--text-subtle))",
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
        chart: {
          revenue: "hsl(var(--chart-revenue))",
          orders: "hsl(var(--chart-orders))",
          positive: "hsl(var(--chart-positive))",
          warning: "hsl(var(--chart-warning))",
          negative: "hsl(var(--chart-negative))",
          neutral: "hsl(var(--chart-neutral))",
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
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.75rem",
        "2xl": "0.75rem",
        "3xl": "0.75rem",
      },
      boxShadow: {
        panel:
          "0 1px 2px rgba(20, 19, 15, 0.035), 0 0 0 1px rgba(20, 19, 15, 0.015)",
        float:
          "0 18px 42px -30px rgba(20, 19, 15, 0.18), 0 4px 16px -12px rgba(20, 19, 15, 0.08)",
        frame:
          "0 32px 64px -36px rgba(20, 19, 15, 0.2), 0 8px 24px -14px rgba(20, 19, 15, 0.08)",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
