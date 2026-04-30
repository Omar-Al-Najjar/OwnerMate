"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/forms/button";
import { createBrowserSupabaseClient } from "@/lib/auth/supabase-browser";

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
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);
    window.localStorage.removeItem("ownermate-profile");
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace(`/${locale}/sign-in`);
    }
  }

  return (
    <Button
      variant="secondary"
      disabled={isPending}
      onClick={handleSignOut}
      type="button"
    >
      {isPending ? pendingLabel : label}
    </Button>
  );
}
