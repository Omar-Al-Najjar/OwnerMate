"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/forms/button";

export function SignOutButton({
  label,
  pendingLabel,
  locale,
}: {
  label: string;
  pendingLabel: string;
  locale: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleSignOut() {
    window.localStorage.removeItem("ownermate-profile");

    await fetch("/api/auth/logout", {
      method: "POST",
    });

    startTransition(() => {
      router.push(`/${locale}/sign-in`);
      router.refresh();
    });
  }

  return (
    <Button
      className="border border-border bg-card text-foreground hover:bg-surface"
      disabled={isPending}
      onClick={handleSignOut}
      type="button"
    >
      {isPending ? pendingLabel : label}
    </Button>
  );
}
