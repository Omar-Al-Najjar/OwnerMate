"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/forms/button";
import { Input } from "@/components/forms/input";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { createBrowserSupabaseClient } from "@/lib/auth/supabase-browser";
import type { Locale } from "@/lib/i18n/config";
import { getPasswordValidationIssues } from "@/lib/auth/password-validation";
import { cn } from "@/lib/utils/cn";
import { getNameValidationIssue } from "@/lib/validation/name-validation";
import type { AuthDictionary, CommonDictionary } from "@/types/i18n";

type AuthFormProps = {
  common: CommonDictionary;
  dictionary: AuthDictionary;
  locale: Locale;
  mode: "sign-in" | "sign-up";
};

type FieldName = "email" | "password" | "fullName";
type FieldErrors = Partial<Record<FieldName, string>>;
type FieldTouched = Partial<Record<FieldName, boolean>>;
type AuthErrorLike = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};

const FULL_NAME_MAX_LENGTH = 25;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3.25 5.75 5.6v5.6c0 4.37 2.65 8.44 6.25 9.55 3.6-1.11 6.25-5.18 6.25-9.55V5.6L12 3.25Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m9.75 12.25 1.55 1.55 3.2-3.45"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m12 3 1.58 4.42L18 9l-4.42 1.58L12 15l-1.58-4.42L6 9l4.42-1.58L12 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m18.5 14 .79 2.21L21.5 17l-2.21.79L18.5 20l-.79-2.21L15.5 17l2.21-.79.79-2.21ZM6 15.5l.6 1.9 1.9.6-1.9.6L6 20.5l-.6-1.9-1.9-.6 1.9-.6.6-1.9Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="8.75" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.75 12h16.5M12 3.25c2.57 2.42 4.13 5.48 4.13 8.75S14.57 18.33 12 20.75c-2.57-2.42-4.13-5.48-4.13-8.75S9.43 5.67 12 3.25Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function BackArrowIcon({ isRtl }: { isRtl: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-4 w-4", isRtl && "rotate-180")}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 6 9 12l6 6M9.5 12H21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        fill="none"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function validateEmail(value: string, dictionary: AuthDictionary) {
  if (!value.trim()) {
    return dictionary.emailInvalidError;
  }

  if (!EMAIL_PATTERN.test(value.trim())) {
    return dictionary.emailInvalidError;
  }

  return "";
}

function validatePassword(
  value: string,
  dictionary: AuthDictionary,
  mode: "sign-in" | "sign-up"
) {
  if (!value.trim()) {
    return dictionary.passwordRequiredError;
  }

  if (mode === "sign-up" && getPasswordValidationIssues(value).length > 0) {
    return dictionary.passwordWeakError;
  }

  return "";
}

function validateFullName(value: string, dictionary: AuthDictionary) {
  if (!value.trim()) {
    return dictionary.nameLengthError;
  }

  if (
    getNameValidationIssue(value, {
      maxLength: FULL_NAME_MAX_LENGTH,
    }) !== null
  ) {
    return dictionary.nameLengthError;
  }

  return "";
}

function getFieldValidation(
  field: FieldName,
  value: string,
  dictionary: AuthDictionary,
  mode: "sign-in" | "sign-up"
) {
  if (field === "email") {
    return validateEmail(value, dictionary);
  }

  if (field === "password") {
    return validatePassword(value, dictionary, mode);
  }

  if (mode === "sign-up") {
    return validateFullName(value, dictionary);
  }

  return "";
}

function resolveAuthErrorMessage(
  error: AuthErrorLike | null | undefined,
  dictionary: AuthDictionary,
  fallback: string
) {
  const normalizedCode = error?.code?.toLowerCase() ?? "";
  const normalizedMessage = error?.message?.toLowerCase() ?? "";

  if (
    normalizedCode === "invalid_credentials" ||
    normalizedMessage.includes("invalid login credentials") ||
    normalizedMessage.includes("invalid_credentials") ||
    normalizedMessage.includes("email not found") ||
    normalizedMessage.includes("password is incorrect")
  ) {
    return dictionary.signInInvalidCredentialsError;
  }

  if (
    normalizedCode === "email_not_confirmed" ||
    normalizedMessage.includes("email not confirmed") ||
    normalizedMessage.includes("email_not_confirmed")
  ) {
    return dictionary.signInEmailNotConfirmedError;
  }

  if (
    error?.status === 429 ||
    normalizedCode === "over_request_rate_limit" ||
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("too many requests")
  ) {
    return dictionary.signInTooManyRequestsError;
  }

  if (
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("fetch") ||
    normalizedMessage.includes("failed to fetch")
  ) {
    return dictionary.signInNetworkError;
  }

  return error?.message || fallback;
}

function toAuthErrorLike(error: unknown): AuthErrorLike | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as Record<string, unknown>;
  return {
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    message:
      typeof candidate.message === "string" ? candidate.message : undefined,
    name: typeof candidate.name === "string" ? candidate.name : undefined,
    status: typeof candidate.status === "number" ? candidate.status : undefined,
  };
}

export function AuthForm({
  common,
  dictionary,
  locale,
  mode,
}: AuthFormProps) {
  const isRtl = locale === "ar";
  const isSignUp = mode === "sign-up";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<FieldTouched>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncExistingSession() {
      if (mode !== "sign-in") {
        return;
      }

      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token || !session.refresh_token || cancelled) {
          return;
        }

        const sessionResponse = await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });

        const sessionBody = (await sessionResponse.json().catch(() => null)) as
          | {
              success?: boolean;
              error?: {
                message?: string;
              };
            }
          | null;

        if (!sessionResponse.ok || !sessionBody?.success) {
          if (!cancelled) {
            setError(sessionBody?.error?.message ?? dictionary.sessionSyncError);
          }
          return;
        }

        if (!cancelled) {
          await new Promise((resolve) => window.setTimeout(resolve, 120));
          window.location.reload();
        }
      } catch (syncError) {
        if (!cancelled) {
          setError(
            resolveAuthErrorMessage(
              toAuthErrorLike(syncError),
              dictionary,
              dictionary.sessionSyncError
            )
          );
        }
      }
    }

    void syncExistingSession();

    return () => {
      cancelled = true;
    };
  }, [dictionary, dictionary.sessionSyncError, locale, mode]);

  function markTouched(field: FieldName) {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));
  }

  function updateFieldError(field: FieldName, value: string) {
    const nextError = getFieldValidation(field, value, dictionary, mode);
    setFieldErrors((current) => ({
      ...current,
      [field]: nextError || undefined,
    }));
    return nextError;
  }

  function validateForm() {
    const nextErrors: FieldErrors = {
      email: validateEmail(email, dictionary) || undefined,
      password: validatePassword(password, dictionary, mode) || undefined,
      ...(isSignUp
        ? {
            fullName: validateFullName(fullName, dictionary) || undefined,
          }
        : {}),
    };

    setTouched({
      email: true,
      password: true,
      ...(isSignUp ? { fullName: true } : {}),
    });
    setFieldErrors(nextErrors);

    return !Object.values(nextErrors).some(Boolean);
  }

  async function handleForgotPassword() {
    setError("");
    setNotice("");
    markTouched("email");

    const emailIssue = validateEmail(email, dictionary);
    if (emailIssue) {
      setFieldErrors((current) => ({
        ...current,
        email: dictionary.forgotPasswordEmailRequired,
      }));
      return;
    }

    setIsResetting(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/sign-in`,
        }
      );

      if (resetError) {
        setError(
          resolveAuthErrorMessage(
            resetError,
            dictionary,
            dictionary.signInErrorFallback
          )
        );
        return;
      }

      setNotice(dictionary.forgotPasswordSuccess);
    } catch (resetError) {
      setError(
        resolveAuthErrorMessage(
          toAuthErrorLike(resetError),
          dictionary,
          dictionary.signInNetworkError
        )
      );
    } finally {
      setIsResetting(false);
    }
  }

  async function submitAuthForm() {
    setError("");
    setNotice("");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/${locale}/dashboard`;

      const result =
        mode === "sign-up"
          ? await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: {
                data: {
                  full_name: fullName.trim() || undefined,
                  language_preference: locale,
                },
                emailRedirectTo: redirectTo,
              },
            })
          : await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });

      if (result.error) {
        setError(
          resolveAuthErrorMessage(
            result.error,
            dictionary,
            mode === "sign-up"
              ? dictionary.signUpErrorFallback
              : dictionary.signInErrorFallback
          )
        );
        return;
      }

      if (mode === "sign-up" && !result.data.session) {
        setNotice(dictionary.signUpSuccessNotice);
        return;
      }

      if (
        result.data.session?.access_token &&
        result.data.session.refresh_token
      ) {
        const sessionResponse = await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token: result.data.session.access_token,
            refresh_token: result.data.session.refresh_token,
          }),
        });

        const sessionBody = (await sessionResponse.json().catch(() => null)) as
          | {
              success?: boolean;
              error?: {
                message?: string;
              };
            }
          | null;

        if (!sessionResponse.ok || !sessionBody?.success) {
          setError(sessionBody?.error?.message ?? dictionary.sessionSyncError);
          return;
        }
      }

      await new Promise((resolve) => window.setTimeout(resolve, 120));
      window.location.reload();
    } catch (submitError) {
      setError(
        resolveAuthErrorMessage(
          toAuthErrorLike(submitError),
          dictionary,
          mode === "sign-up"
            ? dictionary.signUpErrorFallback
            : dictionary.signInNetworkError
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isBusy = isSubmitting;
  const heroEyebrow = isSignUp
    ? dictionary.signUpHeroEyebrow
    : dictionary.signInHeroEyebrow;
  const title = isSignUp ? dictionary.signUp : dictionary.signIn;
  const description = isSignUp
    ? dictionary.signUpDescription
    : dictionary.signInDescription;
  const formAlignment = isRtl ? "text-right" : "text-left";
  const toolbarDirection = isRtl ? "flex-row-reverse" : "flex-row";
  const landingHref = `/${locale}` as Route;
  const backLabel =
    locale === "ar" ? "العودة إلى الصفحة الرئيسية" : "Back to landing page";

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex items-center justify-between gap-3" dir="ltr">
        {isRtl ? (
          <>
            <div
              className="flex items-center gap-1 rounded-2xl border border-border/70 bg-card/70 p-1 shadow-panel backdrop-blur-xl"
              dir="ltr"
            >
              <ThemeToggle
                className="hover:bg-surface-high/80 focus-visible:ring-offset-card"
                common={common}
              />
              <LanguageSwitcher
                className="bg-transparent hover:bg-surface-high/80 focus-visible:ring-offset-card"
                common={common}
                locale={locale}
              />
            </div>
            <Link
              className="inline-flex flex-row-reverse items-center gap-2 rounded-2xl border border-border/70 bg-card/70 px-4 py-2.5 text-sm font-semibold text-foreground shadow-panel backdrop-blur-xl transition hover:bg-surface-high/80 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              href={landingHref}
            >
              <BackArrowIcon isRtl={isRtl} />
              <span>{backLabel}</span>
            </Link>
          </>
        ) : (
          <>
            <Link
              className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-card/70 px-4 py-2.5 text-sm font-semibold text-foreground shadow-panel backdrop-blur-xl transition hover:bg-surface-high/80 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              href={landingHref}
            >
              <BackArrowIcon isRtl={isRtl} />
              <span>{backLabel}</span>
            </Link>
            <div
              className="flex items-center gap-1 rounded-2xl border border-border/70 bg-card/70 p-1 shadow-panel backdrop-blur-xl"
              dir="ltr"
            >
              <LanguageSwitcher
                className="bg-transparent hover:bg-surface-high/80 focus-visible:ring-offset-card"
                common={common}
                locale={locale}
              />
              <ThemeToggle
                className="hover:bg-surface-high/80 focus-visible:ring-offset-card"
                common={common}
              />
            </div>
          </>
        )}
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/82 shadow-float ring-1 ring-white/35 backdrop-blur-2xl dark:ring-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(77,124,255,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(12,28,88,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(80,174,255,0.14),transparent_26%)]" />
        <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-primary/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-8 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-300/10" />

        <div className="relative grid min-h-[720px] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="flex flex-col justify-between border-b border-border/60 p-7 sm:p-10 lg:border-b-0 lg:border-e lg:p-12">
            <div className={cn("space-y-8", formAlignment)}>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-primary-container px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow-lg shadow-primary-container/20">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                {dictionary.trustedBadge}
              </div>

              <div className="space-y-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary dark:text-primary-hover">
                  {heroEyebrow}
                </p>
                <div className="space-y-4">
                  <div
                    className={cn(
                      "inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm font-semibold tracking-[0.24em] text-primary-container shadow-lg shadow-primary/10 backdrop-blur dark:bg-white/5 dark:text-white",
                      isRtl ? "mr-0" : "ml-0"
                    )}
                  >
                    OM
                  </div>
                  <h1 className="max-w-xl text-4xl font-bold tracking-[-0.065em] text-foreground sm:text-5xl lg:text-[3.4rem]">
                    {title}
                  </h1>
                  <p className="max-w-xl text-base leading-8 text-muted sm:text-[1.05rem]">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                {
                  description: dictionary.secureDescription,
                  icon: <ShieldIcon />,
                  title: dictionary.secureTitle,
                },
                {
                  description: dictionary.intelligenceDescription,
                  icon: <SparkIcon />,
                  title: dictionary.intelligenceTitle,
                },
                {
                  description: dictionary.bilingualDescription,
                  icon: <GlobeIcon />,
                  title: dictionary.bilingualTitle,
                },
              ].map((item) => (
                <article
                  className="rounded-3xl border border-border/70 bg-white/55 p-5 shadow-panel backdrop-blur dark:bg-white/5"
                  key={item.title}
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-hover">
                    {item.icon}
                  </div>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="flex items-center p-5 sm:p-8 lg:p-10">
            <div className="mx-auto w-full max-w-lg rounded-[1.75rem] border border-border/70 bg-card/88 p-6 shadow-panel backdrop-blur-xl sm:p-8">
              <div className={cn("mb-8 space-y-3", formAlignment)}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">
                  {heroEyebrow}
                </p>
                <p className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
                  {title}
                </p>
                <p className="text-sm leading-7 text-muted">{description}</p>
              </div>

              <form
                className="space-y-5"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAuthForm();
                }}
              >
                {isSignUp ? (
                  <Input
                    autoComplete="name"
                    error={touched.fullName ? fieldErrors.fullName : undefined}
                    hint={dictionary.fullNameHelper}
                    label={dictionary.fullName}
                    maxLength={FULL_NAME_MAX_LENGTH}
                    name="fullName"
                    onBlur={() => {
                      markTouched("fullName");
                      updateFieldError("fullName", fullName);
                    }}
                    onChange={(event) => {
                      setFullName(event.target.value);
                      if (touched.fullName) {
                        updateFieldError("fullName", event.target.value);
                      }
                    }}
                    placeholder={dictionary.fullName}
                    success={
                      touched.fullName && !fieldErrors.fullName && fullName.trim()
                        ? true
                        : undefined
                    }
                    type="text"
                    value={fullName}
                  />
                ) : null}

                <Input
                  autoComplete="email"
                  error={touched.email ? fieldErrors.email : undefined}
                  hint={dictionary.emailHelper}
                  label={dictionary.email}
                  name="email"
                  onBlur={() => {
                    markTouched("email");
                    updateFieldError("email", email);
                  }}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (touched.email) {
                      updateFieldError("email", event.target.value);
                    }
                  }}
                  placeholder="name@company.com"
                  success={
                    touched.email && !fieldErrors.email && email.trim() ? true : undefined
                  }
                  type="email"
                  value={email}
                />

                <div className="space-y-3">
                  <Input
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    error={touched.password ? fieldErrors.password : undefined}
                    hint={
                      isSignUp
                        ? dictionary.passwordStrengthHint
                        : dictionary.passwordHelper
                    }
                    label={dictionary.password}
                    name="password"
                    onBlur={() => {
                      markTouched("password");
                      updateFieldError("password", password);
                    }}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (touched.password) {
                        updateFieldError("password", event.target.value);
                      }
                    }}
                    placeholder="********"
                    success={
                      touched.password && !fieldErrors.password && password.trim()
                        ? true
                        : undefined
                    }
                    type="password"
                    value={password}
                  />

                  {!isSignUp ? (
                    <div
                      className={cn(
                        "flex items-center justify-end",
                        isRtl ? "justify-start" : "justify-end"
                      )}
                    >
                      <button
                        className="text-sm font-medium text-primary transition hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:text-muted"
                        disabled={isResetting || !isHydrated}
                        onClick={handleForgotPassword}
                        type="button"
                      >
                        {isResetting ? dictionary.authActionPending : dictionary.forgotPassword}
                      </button>
                    </div>
                  ) : null}
                </div>

                {error ? (
                  <div
                    aria-live="polite"
                    className="rounded-2xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error"
                    role="alert"
                  >
                    {error}
                  </div>
                ) : null}

                {notice ? (
                  <div
                    aria-live="polite"
                    className="rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success"
                  >
                    {notice}
                  </div>
                ) : null}

                <Button
                  className="mt-2 min-h-[3.25rem] w-full rounded-2xl text-base"
                  disabled={!isHydrated}
                  isLoading={isBusy}
                  onClick={() => {
                    void submitAuthForm();
                  }}
                  type="button"
                >
                  {isBusy ? <Spinner /> : null}
                  <span>
                    {isBusy
                      ? dictionary.authActionPending
                      : isSignUp
                        ? dictionary.signUpButton
                        : dictionary.signInButton}
                  </span>
                </Button>
              </form>

              <div className="mt-6 rounded-2xl border border-border/70 bg-surface-low/80 p-4">
                <p className="text-sm leading-7 text-muted">
                  {isSignUp ? dictionary.haveAccount : dictionary.noAccount}{" "}
                  <Link
                    className="font-semibold text-primary transition hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-low"
                    href={`/${locale}/${isSignUp ? "sign-in" : "sign-up"}`}
                  >
                    {isSignUp ? dictionary.signInLink : dictionary.signUpLink}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
