import { NextResponse } from "next/server";
import {
  BUSINESS_CONTEXT_COOKIE_NAME,
  clearBusinessContextCache,
} from "@/lib/auth/business-context";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id) {
    clearBusinessContextCache(user.id);
  }
  await supabase.auth.signOut();
  const response = NextResponse.json({ success: true });
  response.cookies.set("ownermate-access-token", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(BUSINESS_CONTEXT_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });
  return response;
}
