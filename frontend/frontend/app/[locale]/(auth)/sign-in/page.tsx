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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,83,219,0.12),transparent_28%),radial-gradient(circle_at_20%_80%,rgba(62,157,255,0.1),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(0,23,75,0.18),transparent_36%)]" />
      <div className="relative w-full">
        <AuthForm
          common={dictionary.common}
          dictionary={dictionary.auth}
          locale={safeLocale}
          mode="sign-in"
        />
      </div>
    </main>
  );
}
