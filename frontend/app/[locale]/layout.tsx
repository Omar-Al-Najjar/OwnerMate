import { ProfileProvider } from "@/components/providers/profile-provider";
import { getDisplayName } from "@/lib/auth/profile-display";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getAppSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { settingsProfile } from "@/lib/mock/settings";
import { getDirection } from "@/lib/utils/direction";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const session = await getAppSession();
  const dictionary = getDictionary(safeLocale);
  const initialProfile = session
    ? {
        fullName: getDisplayName(session.fullName, session.email),
        email: session.email,
        role: session.role.charAt(0).toUpperCase() + session.role.slice(1),
      }
    : settingsProfile.profile;

  return (
    <ThemeProvider
      defaultTheme="system"
      dictionary={dictionary.common}
      dir={getDirection(safeLocale)}
      locale={safeLocale}
    >
      <ProfileProvider initialProfile={initialProfile}>
        {children}
      </ProfileProvider>
    </ThemeProvider>
  );
}
