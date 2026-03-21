import type { Route } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/common/auth-card";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleParams } from "@/types/i18n";

export default async function SignInPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <AuthCard
        ctaHref={`/${safeLocale}/sign-up` as Route}
        description={dictionary.auth.signInDescription}
        fields={[
          {
            label: dictionary.auth.email,
            type: "email",
            placeholder: "name@company.com",
          },
          {
            label: dictionary.auth.password,
            type: "password",
            placeholder: "********",
          },
        ]}
        footerLinkLabel={dictionary.auth.signUpLink}
        footerPrompt={dictionary.auth.noAccount}
        submitLabel={dictionary.auth.signInButton}
        title={dictionary.auth.signIn}
      />
    </main>
  );
}
