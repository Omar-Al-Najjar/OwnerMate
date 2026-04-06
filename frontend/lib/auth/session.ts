import "server-only";

import { cookies } from "next/headers";
import type { UserMetadata } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";

export type AppSession = {
  accessToken: string | null;
  businessId: string | null;
  defaultLanguage: string | null;
  email: string;
  fullName: string | null;
  role: string;
  themePreference: string | null;
  userId: string;
};

function readString(metadata: UserMetadata, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

export async function getAppSession(): Promise<AppSession | null> {
  const supabase = await createServerSupabaseClient();
  const cookieStore = await cookies();
  const [{ data: userResult }, { data: sessionResult }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const user = userResult.user;
  if (!user || !user.email) {
    return null;
  }

  const userMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};
  const appMetadata =
    user.app_metadata && typeof user.app_metadata === "object"
      ? user.app_metadata
      : {};

  return {
    accessToken:
      sessionResult.session?.access_token ??
      cookieStore.get("ownermate-access-token")?.value ??
      null,
    businessId: readString(appMetadata, "business_id"),
    defaultLanguage: readString(userMetadata, "language_preference"),
    email: user.email,
    fullName: readString(userMetadata, "full_name") ?? readString(userMetadata, "name"),
    role: readString(appMetadata, "role") ?? "owner",
    themePreference: readString(userMetadata, "theme_preference"),
    userId: user.id,
  };
}
