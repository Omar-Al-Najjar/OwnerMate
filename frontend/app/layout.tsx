import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import "@/styles/globals.css";

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const arabic = Cairo({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-arabic",
  display: "swap",
  fallback: ["Tahoma", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "OwnerMate",
  description: "Bilingual reviews and sales insights workspace for SMB owners.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning>
      <body className={`${sans.variable} ${arabic.variable}`}>
        {children}
      </body>
    </html>
  );
}
