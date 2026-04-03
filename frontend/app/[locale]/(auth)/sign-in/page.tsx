import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getAppSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleParams } from "@/types/i18n";

export default async function SignInPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const session = await getAppSession();
  const dictionary = getDictionary(safeLocale);

  if (session) {
    redirect(`/${safeLocale}/dashboard`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <AuthForm dictionary={dictionary.auth} locale={safeLocale} mode="sign-in" />
    </main>
  );
}
