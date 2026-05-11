import { supabase } from "@/lib/supabaseClient";
import { Browser } from "@capacitor/browser";

/**
 * Native Authentication Strategy (Capacitor)
 * 
 * Uses a hybrid flow to avoid PKCE verifier issues on mobile.
 * 1. skipBrowserRedirect: true prevents immediate window.location change.
 * 2. Redirects to the backend callback which handles the token exchange.
 * 3. Backend redirects back to socio://auth/callback with tokens.
 * 4. App receives tokens via socio:// scheme.
 */
export async function signInWithGoogleNative() {
  const redirectUrl = "socio://auth/callback";
  
  console.log(`🔍 [AuthDebug] ${new Date().toISOString()} [NativeAuth] Initiating OAuth flow. redirectTo: ${redirectUrl}`);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.error("🔍 [AuthDebug] [NativeAuth] signInWithOAuth Error:", error.message, error);
    throw error;
  }

  console.log("🔍 [AuthDebug] [NativeAuth] signInWithOAuth data:", data);

  // Manually open the Google login in a Chrome Custom Tab / SFSafariViewController
  if (data?.url) {
    console.log(`🔍 [AuthDebug] ${new Date().toISOString()} [NativeAuth] Opening Browser with URL: ${data.url}`);
    await Browser.open({ url: data.url });
  } else {
    throw new Error("No OAuth URL returned from Supabase.");
  }
  
  return data;
}
