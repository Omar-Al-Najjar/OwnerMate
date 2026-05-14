import { LandingPage } from "@/components/marketing/landing-page";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleParams } from "@/types/i18n";

export default async function LocaleIndexPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);

  return (
    <LandingPage
      auth={dictionary.auth}
      common={dictionary.common}
      dictionary={dictionary.landing}
      locale={safeLocale}
    />
  );
}
