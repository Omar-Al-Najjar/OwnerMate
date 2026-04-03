import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { anonKey, url };
}

let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient() {
  if (browserClient) {
    return browserClient;
  }

  const { anonKey, url } = getSupabaseConfig();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
