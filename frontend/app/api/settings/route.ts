import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";
import {
  BackendRouteError,
  fetchBackendJson,
  getAuthenticatedBackendHeaders,
} from "@/lib/api/server";

type SettingsRead = {
  language_preference: "en" | "ar" | null;
  theme_preference: "light" | "dark" | "system" | null;
};

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      fullName?: string;
      language?: "en" | "ar";
      theme?: "light" | "dark" | "system";
    };
    const normalizedFullName =
      typeof payload.fullName === "string" ? payload.fullName.trim() : undefined;
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
