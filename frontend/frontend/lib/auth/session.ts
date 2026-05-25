import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { UserMetadata } from "@supabase/supabase-js";
import {
  BUSINESS_CONTEXT_COOKIE_NAME,
  getCachedBusinessId,
  parseSignedBusinessContextCookie,
  resolveBusinessContext,
  seedBusinessContextCache,
} from "@/lib/auth/business-context";
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

function decodeJwtPayload(token: string) {
  const [, payloadPart] = token.split(".");
  if (!payloadPart) {
    return null;
  }

  try {
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export const getAppSession = cache(async (): Promise<AppSession | null> => {
  const cookieStore = await cookies();
  const cookieAccessToken = cookieStore.get("ownermate-access-token")?.value ?? null;

  if (cookieAccessToken) {
    const tokenPayload = decodeJwtPayload(cookieAccessToken);
    const userId = typeof tokenPayload?.sub === "string" ? tokenPayload.sub : null;
    const email =
      typeof tokenPayload?.email === "string" ? tokenPayload.email : null;

    if (userId && email) {
      const userMetadata =
        tokenPayload?.user_metadata && typeof tokenPayload.user_metadata === "object"
          ? tokenPayload.user_metadata
          : {};
      const appMetadata =
        tokenPayload?.app_metadata && typeof tokenPayload.app_metadata === "object"
          ? tokenPayload.app_metadata
          : {};
      const claimedBusinessId = readString(appMetadata, "business_id");
      const cookieBusinessId = parseSignedBusinessContextCookie(
        cookieStore.get(BUSINESS_CONTEXT_COOKIE_NAME)?.value ?? "",
        userId
      );
      let resolvedBusinessId =
        claimedBusinessId ?? cookieBusinessId ?? getCachedBusinessId(userId);

      if (claimedBusinessId) {
        seedBusinessContextCache(userId, claimedBusinessId);
      } else if (cookieBusinessId) {
        seedBusinessContextCache(userId, cookieBusinessId);
      } else if (!resolvedBusinessId) {
        resolvedBusinessId = await resolveBusinessContext(cookieAccessToken, userId);
      }

      return {
        accessToken: cookieAccessToken,
        businessId: resolvedBusinessId,
        defaultLanguage: readString(userMetadata, "language_preference"),
        email,
        fullName:
          readString(userMetadata, "full_name") ?? readString(userMetadata, "name"),
        role: readString(appMetadata, "role") ?? "owner",
        themePreference: readString(userMetadata, "theme_preference"),
        userId,
      };
    }
  }

  const supabase = await createServerSupabaseClient();
  const { data: sessionResult } = await supabase.auth.getSession();

  let user = sessionResult.session?.user ?? null;
  if (!user?.email) {
    const { data: userResult } = await supabase.auth.getUser();
    user = userResult.user;
  }

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
  const accessToken =
    sessionResult.session?.access_token ??
    cookieStore.get("ownermate-access-token")?.value ??
    null;
  const claimedBusinessId = readString(appMetadata, "business_id");
  const cookieBusinessId = parseSignedBusinessContextCookie(
    cookieStore.get(BUSINESS_CONTEXT_COOKIE_NAME)?.value ?? "",
    user.id
  );
  let resolvedBusinessId =
    claimedBusinessId ?? cookieBusinessId ?? getCachedBusinessId(user.id);

  if (claimedBusinessId) {
    seedBusinessContextCache(user.id, claimedBusinessId);
  } else if (cookieBusinessId) {
    seedBusinessContextCache(user.id, cookieBusinessId);
  } else if (!resolvedBusinessId && accessToken) {
    resolvedBusinessId = await resolveBusinessContext(accessToken, user.id);
  }

  return {
    accessToken,
    businessId: resolvedBusinessId,
    defaultLanguage: readString(userMetadata, "language_preference"),
    email: user.email,
    fullName: readString(userMetadata, "full_name") ?? readString(userMetadata, "name"),
    role: readString(appMetadata, "role") ?? "owner",
    themePreference: readString(userMetadata, "theme_preference"),
    userId: user.id,
  };
});
