import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";
import { getNameValidationIssue } from "@/lib/validation/name-validation";
import {
  BackendRouteError,
  fetchBackendJson,
  getAuthenticatedBackendHeaders,
} from "@/lib/api/server";

type SettingsRead = {
  language_preference: "en" | "ar" | null;
  theme_preference: "light" | "dark" | "system" | null;
  business?: {
    id: string;
    name: string;
    google_review_business_name: string | null;
  } | null;
};

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      fullName?: string;
      language?: "en" | "ar";
      theme?: "light" | "dark" | "system";
      googleReviewBusinessName?: string;
    };
    const normalizedFullName =
      typeof payload.fullName === "string" ? payload.fullName.trim() : undefined;
    const normalizedGoogleReviewBusinessName =
      typeof payload.googleReviewBusinessName === "string"
        ? payload.googleReviewBusinessName.trim()
        : undefined;

    if (
      typeof normalizedFullName === "string" &&
      getNameValidationIssue(normalizedFullName, {
        maxLength: 25,
      }) !== null
    ) {
      throw new BackendRouteError(
        "INVALID_FULL_NAME",
        "Full name must be between 3 and 25 characters.",
        422
      );
    }

    const headers = await getAuthenticatedBackendHeaders();
    const supabase = await createServerSupabaseClient();

    if (typeof normalizedFullName === "string") {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: normalizedFullName || null,
          name: normalizedFullName || null,
        },
      });

      if (error) {
        throw new BackendRouteError(
          "PROFILE_UPDATE_FAILED",
          error.message || "Profile update failed.",
          400
        );
      }

      await fetchBackendJson<SettingsRead>("/settings/profile", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ full_name: normalizedFullName || null }),
      });
    }

    let settings: SettingsRead | null = null;

    if (payload.theme) {
      settings = await fetchBackendJson<SettingsRead>("/settings/theme", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ theme_preference: payload.theme }),
      });
    }

    if (payload.language) {
      settings = await fetchBackendJson<SettingsRead>("/settings/language", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ language_preference: payload.language }),
      });
    }

    if (normalizedGoogleReviewBusinessName !== undefined) {
      settings = await fetchBackendJson<SettingsRead>("/settings/business", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          google_review_business_name:
            normalizedGoogleReviewBusinessName || null,
        }),
      });
    }

    if (!settings) {
      settings = await fetchBackendJson<SettingsRead>("/settings", {
        headers,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        fullName: normalizedFullName ?? null,
        locale: settings.language_preference,
        theme: settings.theme_preference,
        business: settings.business
          ? {
              id: settings.business.id,
              name: settings.business.name,
              googleReviewBusinessName:
                settings.business.google_review_business_name ?? "",
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof BackendRouteError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Settings update failed.",
        },
      },
      { status: 500 }
    );
  }
}
