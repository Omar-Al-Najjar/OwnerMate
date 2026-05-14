import type { Locale } from "@/lib/i18n/config";

export function getDirection(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}
