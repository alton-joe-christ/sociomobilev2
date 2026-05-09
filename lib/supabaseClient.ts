import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase env vars missing — auth will not work");
}

const isApp = typeof window !== "undefined" && Capacitor.isNativePlatform();

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // On native app, we handle session restoration manually via handleDeepLink/setSession.
      // Automatic detection often fails on mobile due to PKCE verifier mismatches.
      detectSessionInUrl: !isApp,
      flowType: isApp ? "implicit" : "pkce",
    },
  }
);
