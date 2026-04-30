"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  success?: boolean | string;
};

export function Input({
  label,
  id,
  className,
  error,
  hint,
  success,
  ...props
}: InputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isRtl, setIsRtl] = useState(false);
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const messageId = `${inputId}-message`;
  const isPasswordField = props.type === "password";
  const inputType =
    isPasswordField && isPasswordVisible ? "text" : props.type ?? "text";
  const describedBy = [props["aria-describedby"], error || hint || success ? messageId : null]
    .filter(Boolean)
    .join(" ");
  const validationTone = error
    ? "border-error/65 bg-error/5 text-foreground placeholder:text-muted focus:border-error focus:ring-error/15"
    : success
      ? "border-success/45 bg-success/5 text-foreground placeholder:text-muted focus:border-success focus:ring-success/15"
      : "border-border/70 bg-surface-lowest/85 text-foreground placeholder:text-muted/90 hover:border-primary/35 focus:border-primary focus:ring-primary/15";

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const syncDirection = () => {
      setIsRtl(document.documentElement.dir === "rtl");
    };

    syncDirection();
    const observer = new MutationObserver(syncDirection);
    observer.observe(document.documentElement, {
      attributeFilter: ["dir"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-2">
      <label
        className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-muted"
        htmlFor={inputId}
      >
        {label}
      </label>
      <span className="relative block">
        <input
          className={cn(
            "w-full rounded-2xl border px-3.5 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] outline-none transition duration-200 focus:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
            isPasswordField ? (isRtl ? "pl-12" : "pr-12") : "",
            validationTone,
            className
          )}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? "true" : "false"}
          id={inputId}
          {...props}
          type={inputType}
        />
        {isPasswordField ? (
          <button
            aria-label={isPasswordVisible ? "Hide characters" : "Show characters"}
            aria-controls={inputId}
            className={cn(
              "absolute top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-muted transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              isRtl ? "left-2" : "right-2"
            )}
            onClick={() => setIsPasswordVisible((current) => !current)}
            type="button"
          >
            {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        ) : null}
      </span>
      {error ? (
        <span
          aria-live="polite"
          className="block text-sm font-medium text-error"
          id={messageId}
          role="alert"
        >
          {error}
        </span>
      ) : success ? (
        <span
          aria-live="polite"
          className="block text-sm font-medium text-success"
          id={messageId}
        >
          {typeof success === "string" ? success : hint ?? ""}
        </span>
      ) : hint ? (
        <span className="block text-sm text-muted" id={messageId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.75 12s3.35-6.25 9.25-6.25S21.25 12 21.25 12s-3.35 6.25-9.25 6.25S2.75 12 2.75 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 3 21 21M10.54 5.98A9.66 9.66 0 0 1 12 5.75c5.9 0 9.25 6.25 9.25 6.25a17.42 17.42 0 0 1-3.24 3.98M6.25 8.18C4.13 10.04 2.75 12 2.75 12S6.1 18.25 12 18.25c1.54 0 2.9-.43 4.09-1.08M9.7 9.7A3.25 3.25 0 0 0 14.3 14.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
