import { AppShell } from "@/components/layout/app-shell";
import { getAppSession } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveLocale } from "@/lib/i18n/config";
import { redirect } from "next/navigation";

export default async function AppLayout({
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

  if (!session) {
    redirect(`/${safeLocale}/sign-in`);
  }

  return (
    <AppShell
      common={dictionary.common}
      locale={safeLocale}
      navigation={dictionary.navigation}
      shell={dictionary.shell}
      signOutLabel={dictionary.auth.signOutButton}
      signOutPendingLabel={dictionary.auth.authActionPending}
    >
      {children}
    </AppShell>
  );
}
