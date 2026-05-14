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
    <div className="rounded-2xl bg-surface-low px-3.5 py-2.5 text-start ring-1 ring-inset ring-border/70">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">
        {mounted && formatted ? formatted.date : "-- --- --, ----"}
      </p>
      <p className="mt-1 font-display text-sm font-bold tracking-[-0.04em] text-foreground">
        {mounted && formatted ? formatted.time : "--:--:--"}
      </p>
    </div>
  );
}
