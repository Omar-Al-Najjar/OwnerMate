"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";

function formatNow(locale: Locale, value: Date) {
  return {
    date: new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(value),
    time: new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(value),
  };
}

export function CurrentDateTime({ locale }: { locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const formatted = now ? formatNow(locale, now) : null;

  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-2 text-start shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {mounted && formatted ? formatted.date : "-- --- --, ----"}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {mounted && formatted ? formatted.time : "--:--:--"}
      </p>
    </div>
  );
}
