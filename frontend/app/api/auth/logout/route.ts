import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  const response = NextResponse.json({ success: true });
  response.cookies.set("ownermate-access-token", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });
  return response;
}
