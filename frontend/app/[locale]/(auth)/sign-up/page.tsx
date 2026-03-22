import type { Route } from "next";
import { AuthCard } from "@/components/common/auth-card";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleParams } from "@/types/i18n";

export default async function SignUpPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <AuthCard
        ctaHref={`/${safeLocale}/sign-in` as Route}
        description={dictionary.auth.signUpDescription}
        fields={[
          {
            label: dictionary.auth.fullName,
            type: "text",
            placeholder: dictionary.auth.fullName,
          },
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
        footerLinkLabel={dictionary.auth.signInLink}
        footerPrompt={dictionary.auth.haveAccount}
        submitLabel={dictionary.auth.signUpButton}
        title={dictionary.auth.signUp}
      />
    </main>
  );
}
