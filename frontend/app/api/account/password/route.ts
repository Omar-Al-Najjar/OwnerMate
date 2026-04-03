import { NextResponse } from "next/server";
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
