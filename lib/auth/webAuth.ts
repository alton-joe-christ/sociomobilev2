import { supabase } from "@/lib/supabaseClient";

/**
 * Web Authentication Strategy
 * 
 * Uses the standard Supabase OAuth flow which defaults to PKCE.
 * Suitable for Desktop Browsers, Mobile Browsers, and PWA installs.
 */
export async function signInWithGoogleWeb() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Redirect to the backend callback which handles the PKCE exchange for Web
      redirectTo: "https://socio2026v2server.vercel.app/api/auth/callback",
    },
  });

  if (error) throw error;
  
  // Note: On web, supabase.auth.signInWithOAuth automatically handles the redirect 
  // unless skipBrowserRedirect: true is passed.
  return data;
}
