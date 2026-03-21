import { ThemeProvider } from "@/components/providers/theme-provider";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { settingsProfile } from "@/lib/mock/settings";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDirection } from "@/lib/utils/direction";
import { resolveLocale } from "@/lib/i18n/config";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);

  return (
    <ThemeProvider
      defaultTheme="system"
      dictionary={dictionary.common}
      dir={getDirection(safeLocale)}
      locale={safeLocale}
    >
      <ProfileProvider initialProfile={settingsProfile.profile}>
        {children}
      </ProfileProvider>
    </ThemeProvider>
  );
}
