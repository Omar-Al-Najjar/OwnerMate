import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/forms/button";
import { Input } from "@/components/forms/input";

type AuthField = {
  label: string;
  type: string;
  placeholder: string;
};

type AuthCardProps = {
  title: string;
  description: string;
  fields: AuthField[];
  submitLabel: string;
  footerPrompt: string;
  footerLinkLabel: string;
  ctaHref: Route;
};

export function AuthCard({
  title,
  description,
  fields,
  submitLabel,
  footerPrompt,
  footerLinkLabel,
  ctaHref,
}: AuthCardProps) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-panel sm:p-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm leading-6 text-muted">{description}</p>
      </div>
      <form className="space-y-4">
        {fields.map((field) => (
          <Input
            key={field.label}
            label={field.label}
            placeholder={field.placeholder}
            type={field.type}
          />
        ))}
        <Button className="w-full" type="submit">
          {submitLabel}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {footerPrompt}{" "}
        <Link
          className="font-medium text-primary hover:text-primary-hover"
          href={ctaHref}
        >
          {footerLinkLabel}
        </Link>
      </p>
    </div>
  );
}
