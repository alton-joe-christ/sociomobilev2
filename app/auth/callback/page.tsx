"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";

import { Suspense } from "react";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, refreshUserData } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If AuthContext already picked up the session via detectSessionInUrl, we just redirect.
    if (session) {
      const next = searchParams.get("next") || "/";
      
      const returnTo = sessionStorage.getItem("returnTo");
      if (returnTo) sessionStorage.removeItem("returnTo");
      router.replace(returnTo || next);
      return;
    }

    const code = searchParams.get("code");
    const token = searchParams.get("token") || searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      setError(errorDescription || "Authentication failed");
      setTimeout(() => router.replace("/auth"), 2000);
      return;
    }

    if (token && refreshToken) {
      const processTokens = async () => {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshToken,
        });
        if (sessionErr) {
          setError(sessionErr.message);
          setTimeout(() => router.replace("/auth"), 2000);
        } else {
          await refreshUserData();
          const next = searchParams.get("next") || "/";
          router.replace(next);
        }
      };
      processTokens();
      return;
    }

    if (!code) {
      // No code and no session, wait a bit or redirect
      const checkSession = async () => {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          await refreshUserData();
          const next = searchParams.get("next") || "/";
          router.replace(next);
        } else {
          router.replace("/auth");
        }
      };
      checkSession();
      return;
    }
    
    // We have a code but no session yet. 
    // Supabase client should automatically exchange it because detectSessionInUrl: true.
    // However, if we want to guarantee it or speed it up, we can attempt it, but catch the "already used" error cleanly.
    let isMounted = true;
    const processCode = async () => {
      try {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          // If the verifier was already consumed (e.g. detectSessionInUrl beat us to it)
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            // Already handled!
            return;
          }
          throw exchangeError;
        }
      } catch (err: any) {
        // If it throws, check one more time before failing (in case of race conditions)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession && isMounted) {
          console.error("Auth callback error:", err);
          setError("Session expired or invalid link. Please sign in again.");
          setTimeout(() => router.replace("/auth"), 2000);
        }
      }
    };
    
    processCode();
    
    return () => { isMounted = false; };
  }, [router, searchParams, session, refreshUserData]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <p className="text-sm text-gray-400">Redirecting to login...</p>
      </div>
    );
  }

  return <LoadingScreen />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
