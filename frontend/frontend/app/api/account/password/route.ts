import { NextResponse } from "next/server";
import { getPasswordValidationIssues } from "@/lib/auth/password-validation";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";
import { getAppSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const session = await getAppSession();

    if (!session?.email) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required.",
          },
        },
        { status: 401 }
      );
    }

    if (!payload.currentPassword?.trim() || !payload.newPassword?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PASSWORD_INPUT_REQUIRED",
            message: "Both current and new passwords are required.",
          },
        },
        { status: 400 }
      );
    }

    if (payload.currentPassword === payload.newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PASSWORD_REUSE_NOT_ALLOWED",
            message: "Choose a new password that is different from the current password.",
          },
        },
        { status: 400 }
      );
    }

    const passwordIssues = getPasswordValidationIssues(payload.newPassword);

    if (passwordIssues.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "WEAK_PASSWORD",
            message:
              "Choose a stronger password with at least 8 characters, including uppercase, lowercase, a number, and a special character.",
            issues: passwordIssues,
          },
        },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const signInResult = await supabase.auth.signInWithPassword({
      email: session.email,
      password: payload.currentPassword,
    });

    if (signInResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CURRENT_PASSWORD_INVALID",
            message: "Current password is incorrect.",
          },
        },
        { status: 400 }
      );
    }

    const updateResult = await supabase.auth.updateUser({
      password: payload.newPassword,
    });

    if (updateResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PASSWORD_UPDATE_FAILED",
            message: updateResult.error.message || "Password update failed.",
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Password update failed.",
        },
      },
      { status: 500 }
    );
  }
}
