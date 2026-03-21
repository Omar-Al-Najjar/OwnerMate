import { AppShell } from "@/components/layout/app-shell";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocale } from "@/lib/i18n/config";

export default async function AppLayout({
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
    <AppShell
      common={dictionary.common}
      locale={safeLocale}
      navigation={dictionary.navigation}
      shell={dictionary.shell}
    >
      {children}
    </AppShell>
  );
}
