import { NextResponse } from "next/server";
import {
  BUSINESS_CONTEXT_COOKIE_NAME,
  createSignedBusinessContextCookie,
  seedBusinessContextCache,
} from "@/lib/auth/business-context";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";

function getBackendBaseUrl() {
  return process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8000";
}

function decodeJwtPart(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
}

type BackendAuthSession = {
  user?: {
    id?: string;
  };
  businesses?: Array<{
    id?: string | null;
  }>;
};

type BackendEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: {
    message?: string;
    code?: string;
  };
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!payload.access_token || !payload.refresh_token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SESSION_TOKENS_REQUIRED",
            message: "Access token and refresh token are required.",
          },
        },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SESSION_SYNC_FAILED",
            message: error.message || "Session sync failed.",
          },
        },
        { status: 400 }
      );
    }

    const backendResponse = await fetch(`${getBackendBaseUrl()}/auth/me`, {
      headers: {
        Authorization: `Bearer ${payload.access_token}`,
      },
      cache: "no-store",
    });
    const backendBody = (await backendResponse.json().catch(() => null)) as
      | BackendEnvelope<BackendAuthSession>
      | null;

    if (!backendResponse.ok || !backendBody?.success) {
      const [headerPart, payloadPart] = payload.access_token.split(".");

      try {
        const tokenHeader = headerPart ? decodeJwtPart(headerPart) : null;
        const tokenPayload = payloadPart ? decodeJwtPart(payloadPart) : null;
        console.error("auth-session backend sync failed", {
          status: backendResponse.status,
          backendCode: backendBody?.error?.code ?? null,
          backendMessage: backendBody?.error?.message ?? null,
          tokenAlg: tokenHeader?.alg ?? null,
          tokenIss: tokenPayload?.iss ?? null,
          tokenAud: tokenPayload?.aud ?? null,
          tokenSubPrefix:
            typeof tokenPayload?.sub === "string"
              ? tokenPayload.sub.slice(0, 8)
              : null,
          tokenHasEmail: typeof tokenPayload?.email === "string",
          tokenRole: tokenPayload?.role ?? null,
        });
      } catch (error) {
        console.error("auth-session token debug decode failed", error);
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BACKEND_AUTH_SYNC_FAILED",
            message:
              backendBody?.error?.message ??
              "Backend auth sync failed for the current session.",
          },
        },
        { status: backendResponse.status || 400 }
      );
    }

    const [, payloadPart] = payload.access_token.split(".");
    const accessTokenPayload = payloadPart ? decodeJwtPart(payloadPart) : null;
    const resolvedUserId =
      typeof accessTokenPayload?.sub === "string"
        ? accessTokenPayload.sub
        : null;
    const resolvedBusinessId = backendBody.data?.businesses?.[0]?.id ?? null;
    if (resolvedUserId && resolvedBusinessId) {
      seedBusinessContextCache(resolvedUserId, resolvedBusinessId);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("ownermate-access-token", payload.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60,
    });
    const signedBusinessContext = resolvedUserId
      ? createSignedBusinessContextCookie(
          resolvedUserId,
          resolvedBusinessId ?? ""
        )
      : null;
    if (signedBusinessContext) {
      response.cookies.set(BUSINESS_CONTEXT_COOKIE_NAME, signedBusinessContext, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60,
      });
    }
    return response;
  } catch (error) {
    console.error("auth session route failed", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Session sync failed.",
        },
      },
      { status: 500 }
    );
  }
}
