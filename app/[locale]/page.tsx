import { redirect } from "next/navigation";
import { resolveLocale } from "@/lib/i18n/config";
import type { LocaleParams } from "@/types/i18n";

export default async function LocaleIndexPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  redirect(`/${safeLocale}/dashboard`);
}
