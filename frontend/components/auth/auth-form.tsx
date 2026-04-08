"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/forms/button";
import { Input } from "@/components/forms/input";
import { createBrowserSupabaseClient } from "@/lib/auth/supabase-browser";
import { getPasswordValidationIssues } from "@/lib/auth/password-validation";
import { getNameValidationIssue } from "@/lib/validation/name-validation";
import type { Locale } from "@/lib/i18n/config";
import type { AuthDictionary } from "@/types/i18n";

type AuthFormProps = {
  dictionary: AuthDictionary;
  locale: Locale;
  mode: "sign-in" | "sign-up";
};

const FULL_NAME_MAX_LENGTH = 25;

export function AuthForm({ dictionary, locale, mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function syncExistingSession() {
      if (mode !== "sign-in") {
        return;
      }

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
          setError(sessionBody?.error?.message ?? dictionary.signInErrorFallback);
        }
        return;
      }

      if (!cancelled) {
        startTransition(() => {
          router.push(`/${locale}/dashboard`);
          router.refresh();
        });
      }
    }

    void syncExistingSession();

    return () => {
      cancelled = true;
    };
  }, [dictionary.signInErrorFallback, locale, mode, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const supabase = createBrowserSupabaseClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/${locale}/dashboard`;

    if (mode === "sign-up" && getPasswordValidationIssues(password).length > 0) {
      setError(dictionary.passwordWeakError);
      return;
    }

    if (
      mode === "sign-up" &&
      getNameValidationIssue(fullName, { maxLength: FULL_NAME_MAX_LENGTH }) !==
        null
    ) {
      setError(dictionary.nameLengthError);
      return;
    }

    const result =
      mode === "sign-up"
        ? await supabase.auth.signUp({
            email,
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
            email,
            password,
          });

    if (result.error) {
      setError(
        result.error.message ||
          (mode === "sign-up"
            ? dictionary.signUpErrorFallback
            : dictionary.signInErrorFallback)
      );
      return;
    }

    if (mode === "sign-up" && !result.data.session) {
      setNotice(dictionary.signUpSuccessNotice);
      return;
    }

    if (result.data.session?.access_token && result.data.session.refresh_token) {
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
        setError(
          sessionBody?.error?.message ?? dictionary.signInErrorFallback
        );
        return;
      }
    }

    startTransition(() => {
      router.push(`/${locale}/dashboard`);
      router.refresh();
    });
  }

  const isSignUp = mode === "sign-up";

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-panel sm:p-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {isSignUp ? dictionary.signUp : dictionary.signIn}
        </h1>
        <p className="text-sm leading-6 text-muted">
          {isSignUp ? dictionary.signUpDescription : dictionary.signInDescription}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {isSignUp ? (
          <Input
            autoComplete="name"
            label={dictionary.fullName}
            name="fullName"
            onChange={(event) => setFullName(event.target.value)}
            placeholder={dictionary.fullName}
            maxLength={FULL_NAME_MAX_LENGTH}
            type="text"
            value={fullName}
          />
        ) : null}
        <Input
          autoComplete="email"
          label={dictionary.email}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@company.com"
          type="email"
          value={email}
        />
        <Input
          autoComplete={isSignUp ? "new-password" : "current-password"}
          label={dictionary.password}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="********"
          type="password"
          value={password}
        />
        {isSignUp ? (
          <p className="text-sm text-muted">{dictionary.passwordStrengthHint}</p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending
            ? dictionary.authActionPending
            : isSignUp
              ? dictionary.signUpButton
              : dictionary.signInButton}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {isSignUp ? dictionary.haveAccount : dictionary.noAccount}{" "}
        <Link
          className="font-medium text-primary hover:text-primary-hover"
          href={`/${locale}/${isSignUp ? "sign-in" : "sign-up"}`}
        >
          {isSignUp ? dictionary.signInLink : dictionary.signUpLink}
        </Link>
      </p>
    </div>
  );
}
