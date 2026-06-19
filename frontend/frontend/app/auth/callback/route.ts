import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";

function getSafeRedirectOrigin(requestUrl: URL) {
  const hostname = requestUrl.hostname;
  if (hostname === "0.0.0.0") {
    return `${requestUrl.protocol}//localhost${requestUrl.port ? `:${requestUrl.port}` : ""}`;
  }

  return requestUrl.origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/en/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, getSafeRedirectOrigin(requestUrl)));
}
