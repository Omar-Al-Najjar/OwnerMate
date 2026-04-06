import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/config";
import type { LocaleParams } from "@/types/i18n";

export default async function LocaleIndexPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const session = await getAppSession();
  redirect(`/${safeLocale}/${session ? "dashboard" : "sign-in"}`);
}
