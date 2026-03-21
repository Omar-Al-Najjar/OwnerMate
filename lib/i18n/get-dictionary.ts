import type { Locale } from "@/lib/i18n/config";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";

const dictionaries = {
  en,
  ar,
} as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
