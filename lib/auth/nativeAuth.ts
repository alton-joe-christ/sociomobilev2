import { supabase } from "@/lib/supabaseClient";
import { Browser } from "@capacitor/browser";
import { PWA_API_URL } from "@/lib/apiConfig";

/**
 * Native Authentication Strategy (Capacitor)
 * 
 * Uses a deep-link token flow to avoid PKCE verifier issues on mobile.
 * 1. skipBrowserRedirect: true prevents immediate window.location change.
 * 2. Redirects to the backend callback which handles the token exchange.
 * 3. App receives tokens via socio:// scheme.
 */
export async function signInWithGoogleNative() {
  // Use direct socio:// deep link for native auth to bypass the backend PKCE exchange
  const redirectUrl = "socio://auth/callback";
  
  console.log(`[NativeAuth] Initiating OAuth flow. redirectUrl: ${redirectUrl}`);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;

  // Manually open the Google login in a Chrome Custom Tab / SFSafariViewController
  if (data?.url) {
    console.log("[NativeAuth] Opening Browser with URL:", data.url);
    await Browser.open({ url: data.url });
  } else {
    throw new Error("No OAuth URL returned from Supabase.");
  }
  
  return data;
}
