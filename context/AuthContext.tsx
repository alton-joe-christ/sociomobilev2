"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/lib/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";
import { signInWithGoogleWeb } from "@/lib/auth/webAuth";
import { signInWithGoogleNative } from "@/lib/auth/nativeAuth";
import { apiRequest } from "@/lib/apiClient";
import { PWA_API_URL } from "@/lib/apiConfig";

/* ── Local-storage helpers for PWA session persistence ── */
const LS_SESSION_KEY = "socio_pwa_session";
const LS_USER_KEY = "socio_pwa_user_data";

function persistSessionToLS(session: Session | null) {
  try {
    if (session) {
      localStorage.setItem(LS_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(LS_SESSION_KEY);
    }
  } catch {}
}

function restoreSessionFromLS(): Session | null {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    localStorage.removeItem(LS_SESSION_KEY);
    return null;
  }
}

function persistUserDataToLS(user: UserData | null) {
  try {
    if (user) {
      localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LS_USER_KEY);
    }
  } catch {}
}

function restoreUserDataFromLS(): UserData | null {
  try {
    const raw = localStorage.getItem(LS_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserData;
  } catch {
    localStorage.removeItem(LS_USER_KEY);
    return null;
  }
}

/* ── Types ── */
export interface VolunteerAssignment {
  register_number: string;
  expires_at: string;
  assigned_by: string;
}

export interface VolunteerEvent {
  event_id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  end_date: string | null;
  end_time: string | null;
  venue: string | null;
  campus_hosted_at: string | null;
  volunteer_assignment: VolunteerAssignment | null;
}

export interface UserRoles {
  organiser?: boolean;
  support?: boolean;
  masteradmin?: boolean;
  hod?: boolean;
  dean?: boolean;
  cfo?: boolean;
  campus_director?: boolean;
  accounts_office?: boolean;
  it_support?: boolean;
  venue_manager?: boolean;
  stalls?: boolean;
  catering?: boolean;
}

export interface CateringInfo {
  is_catering: boolean;
  catering_id: string;
}

export interface UserData {
  id: number | string;
  email: string;
  name: string;
  register_number: string | null;
  course: string | null;
  department: string | null;
  campus: string | null;
  avatar_url: string | null;
  is_organiser: boolean;
  is_support: boolean;
  is_masteradmin: boolean;
  organization_type: "christ_member" | "outsider";
  visitor_id: string | null;
  outsider_name_edit_used: boolean;
  caters?: CateringInfo[];
  created_at: string;
  roles?: UserRoles;
  volunteerEvents?: VolunteerEvent[];
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  userData: UserData | null;
  isLoading: boolean;
  isAuthReady: boolean;
  isAuthenticated: boolean;
  needsCampus: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  session: null,
  user: null,
  userData: null,
  isLoading: true,
  isAuthReady: false,
  isAuthenticated: false,
  needsCampus: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshUserData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function getFriendlyOutsiderNameError(rawError?: string | null) {
  const normalized = String(rawError || "").trim().toLowerCase();
  if (!normalized) return "We couldn't save your name right now. Please try again.";
  if (normalized.includes("name edit already used")) {
    return "Your one-time name update has already been used.";
  }
  if (normalized.includes("unauthorized")) {
    return "Your session expired. Please sign in again and retry.";
  }
  if (normalized.includes("only outsider users can edit name")) {
    return "This update option is available only for visitor accounts.";
  }
  if (normalized.includes("name must be a non-empty string") || normalized.includes("name cannot be empty")) {
    return "Please enter your display name before saving.";
  }
  if (normalized.includes("network")) {
    return "Network issue detected. Please check your connection and try again.";
  }
  return rawError || "We couldn't save your name right now. Please try again.";
}

function getOrgType(email: string): "christ_member" | "outsider" {
  return email.toLowerCase().endsWith("christuniversity.in")
    ? "christ_member"
    : "outsider";
}

/* ── Provider ── */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authTimings, setAuthTimings] = useState({ start: 0, sessionReady: 0, profileReady: 0 });

  // 🔍 [AuthDebug] Trace all critical state changes
  useEffect(() => {
    console.log(`🔍 [AuthDebug] contextState: isLoading=${isLoading}, isAuthReady=${isAuthReady}, user=${user?.email || "null"}, userData=${userData?.name || "null"}, isAuth=${isAuthenticated}`);
  }, [isLoading, isAuthReady, user, userData, isAuthenticated]);

  useEffect(() => {
    if (isHydrated && isAuthReady) {
      const total = Date.now() - authTimings.start;
      console.log(`🚀 [PERF] Auth Flow Complete in ${total}ms. Session: ${authTimings.sessionReady - authTimings.start}ms, Profile: ${authTimings.profileReady - authTimings.sessionReady}ms`);
    }
  }, [isHydrated, isAuthReady, authTimings]);

  // Ensure isAuthenticated is always in sync with user
  useEffect(() => {
    const isAuth = !!user;
    if (isAuth !== isAuthenticated) {
      console.log(`🔍 [AuthDebug] Syncing isAuthenticated -> ${isAuth}`);
      setIsAuthenticated(isAuth);
    }
  }, [user, isAuthenticated]);
  
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showOutsiderWarning, setShowOutsiderWarning] = useState(false);
  const [outsiderVisitorId, setOutsiderVisitorId] = useState<string | null>(null);
  const [outsiderNameInput, setOutsiderNameInput] = useState("");
  const [isEditingOutsiderName, setIsEditingOutsiderName] = useState(false);
  const [isSavingOutsiderName, setIsSavingOutsiderName] = useState(false);
  const [outsiderNameError, setOutsiderNameError] = useState<string | null>(null);

  /* Schedule a proactive token refresh 60 s before the access token expires */
  const scheduleTokenRefresh = useCallback((s: Session | null) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (!s) return;

    const expiresAt = s.expires_at; // unix seconds
    if (!expiresAt) return;

    const msUntilExpiry = expiresAt * 1000 - Date.now() - 60_000; // 60 s buffer
    if (msUntilExpiry <= 0) {
      supabase.auth.refreshSession();
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      supabase.auth.refreshSession();
    }, msUntilExpiry);
  }, []);

  /* Fetch profile from backend */
  const fetchUserData = useCallback(async function fetchUserDataInternal(email: string, accessToken?: string, retryCount = 0): Promise<UserData | null> {
    const platform = Capacitor.getPlatform();
    console.time(`🔍 [AuthDebug] ProfileFetch-${email}`);
    console.log(`[API] endpoint: /users/me, token exists: ${!!accessToken}, user id: ${email}, platform: ${platform}`);
    
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    // Abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout protection

    try {
      const res = await apiRequest(
        accessToken ? `/users/me` : `/users/${encodeURIComponent(email)}`,
        {
          headers,
          cache: "no-store",
          signal: controller.signal
        }
      );
      console.log(`[API] response for /users/me (${email}), platform: ${platform}`);
      clearTimeout(timeoutId);

      const data = res as any;
      console.log(`🔍 [AuthDebug] fetchUserData: SUCCESS. Data keys: ${Object.keys(data).join(", ")}`);
      const fetchedUser = data.user ?? data;
      fetchedUser.roles = fetchedUser.roles ?? data.roles ?? {};

      if (fetchedUser.caters && fetchedUser.caters.some((c: any) => c.is_catering)) {
        fetchedUser.roles.catering = true;
      }

      fetchedUser.roles = {
        catering: fetchedUser.roles.catering,
      };

      let volEvents = Array.isArray(fetchedUser.volunteerEvents)
        ? fetchedUser.volunteerEvents
        : Array.isArray(data.volunteerEvents)
          ? data.volunteerEvents
          : undefined;

      if (volEvents === undefined && accessToken) {
        try {
          console.log(`[API] endpoint: /volunteer/events, token exists: ${!!accessToken}, platform: ${Capacitor.getPlatform()}`);
          const volRes = await apiRequest(`/volunteer/events`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
            signal: AbortSignal.timeout(8000)
          });
          volEvents = volRes.events || [];
        } catch (err) {
          console.error("Failed to fetch volunteer events during /me fetch", err);
          volEvents = [];
        }
      }

      fetchedUser.volunteerEvents = volEvents || [];
      setUserData(fetchedUser);
      persistUserDataToLS(fetchedUser);
      return fetchedUser;
    } catch (e: any) {
      console.error(`🔍 [AuthDebug] fetchUserData Error: ${e.message}`);
    } finally {
      clearTimeout(timeoutId);
      console.timeEnd(`🔍 [AuthDebug] ProfileFetch-${email}`);
    }

    if (retryCount < 2) {
      console.log(`🔍 [AuthDebug] fetchUserData: Retrying (${retryCount + 1})...`);
      await new Promise(r => setTimeout(r, 2000));
      return fetchUserDataInternal(email, accessToken, retryCount + 1);
    }

    return null;
  }, []);

  const maybeShowOutsiderWelcome = useCallback((fetchedUser: UserData | null, authUserId?: string) => {
    if (
      fetchedUser?.organization_type === "outsider" &&
      fetchedUser.visitor_id &&
      !fetchedUser.outsider_name_edit_used
    ) {
      setOutsiderVisitorId(fetchedUser.visitor_id);
      const warningKey = `outsider_warning_${authUserId || fetchedUser.email}`;
      const hasSeenWarning = localStorage.getItem(warningKey);
      if (!hasSeenWarning) {
        setShowOutsiderWarning(true);
        localStorage.setItem(warningKey, "true");
      }
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (user?.email) await fetchUserData(user.email, session?.access_token);
  }, [fetchUserData, session?.access_token, user?.email]);

  const ensureUser = useCallback(
    async (supaUser: User) => {
      const email = supaUser.email!;
      console.time(`🔍 [AuthDebug] TotalProfileInit-${email}`);
      console.log(`🔍 [AuthDebug] ensureUser: Starting background initialization for ${email}`);
      
      const orgType = getOrgType(email);
      let fullName = supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || "";
      let registerNumber: string | null = null;
      let course: string | null = null;

      if (orgType === "christ_member") {
        const domain = email.split("@")[1] || "";
        const sub = domain.split(".")[0]?.toUpperCase();
        if (sub && sub !== "CHRISTUNIVERSITY") course = sub;
        const lastName = supaUser.user_metadata?.last_name?.trim();
        if (lastName && /^\d+$/.test(lastName)) {
          registerNumber = lastName;
        } else if (fullName) {
          const parts = fullName.split(" ");
          const last = parts[parts.length - 1]?.trim();
          if (/^\d+$/.test(last || "")) {
            registerNumber = last!;
            fullName = parts.slice(0, -1).join(" ");
          }
        }
      }

      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (s?.access_token) headers.Authorization = `Bearer ${s.access_token}`;

        // Non-blocking POST
        console.log(`🔍 [AuthDebug] ensureUser: Sending POST /users for ${email}...`);
        await apiRequest(`/users`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user: {
              id: supaUser.id,
              email,
              name: fullName || email.split("@")[0],
              avatar_url: supaUser.user_metadata?.avatar_url,
              register_number: registerNumber,
              course,
            },
          }),
        });
        console.log(`🔍 [AuthDebug] ensureUser: POST /users request completed`);
      } catch (err) {
        console.error("🔍 [AuthDebug] ensureUser: Setup error:", err);
      }

      // 3. Serialized Profile Hydration (Only after POST attempt)
      console.log(`🔍 [AuthDebug] ensureUser: Proceeding to Profile Hydration...`);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const fetchedUser = await fetchUserData(email, currentSession?.access_token);
      
      if (fetchedUser) {
        console.log(`🔍 [AuthDebug] ensureUser: SUCCESS. Profile hydrated.`);
        setAuthTimings(prev => ({ ...prev, profileReady: Date.now() }));
        setIsAuthReady(true);
        maybeShowOutsiderWelcome(fetchedUser, supaUser.id);
      } else {
        console.warn(`🔍 [AuthDebug] ensureUser: Profile fetch failed. USING FALLBACK HYDRATION.`);
        // ... (fallback logic)
        const fallbackUser: UserData = {
          id: supaUser.id,
          email: supaUser.email!,
          name: supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || supaUser.email!.split("@")[0],
          avatar_url: supaUser.user_metadata?.avatar_url || null,
          organization_type: getOrgType(supaUser.email!),
          register_number: registerNumber,
          course: course,
          campus: null,
          department: null,
          is_organiser: false,
          is_support: false,
          is_masteradmin: false,
          visitor_id: null,
          outsider_name_edit_used: false,
          created_at: new Date().toISOString(),
          roles: {},
          volunteerEvents: []
        };
        
        setUserData(fallbackUser);
        persistUserDataToLS(fallbackUser);
        setAuthTimings(prev => ({ ...prev, profileReady: Date.now() }));
        setIsAuthReady(true);
      }
      
      console.timeEnd(`🔍 [AuthDebug] TotalProfileInit-${email}`);
    },
    [fetchUserData, maybeShowOutsiderWelcome]
  );

  const saveOutsiderName = useCallback(
    async (name: string) => {
      if (!userData?.email || !outsiderVisitorId) return;

      setIsSavingOutsiderName(true);
      setOutsiderNameError(null);
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

        const resp = await fetch(`${PWA_API_URL}/users/${encodeURIComponent(userData.email)}/name`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            name: name.trim(),
            visitor_id: outsiderVisitorId,
          }),
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setOutsiderNameError(getFriendlyOutsiderNameError(data.error));
          return;
        }

        setShowOutsiderWarning(false);
        setIsEditingOutsiderName(false);
        await fetchUserData(userData.email, session?.access_token);
      } catch {
        setOutsiderNameError(getFriendlyOutsiderNameError("Network error"));
      } finally {
        setIsSavingOutsiderName(false);
      }
    },
    [fetchUserData, outsiderVisitorId, session?.access_token, userData?.email]
  );

  /* Note: Background 60-second role refresh was removed for mobile to ensure it only fetches once */

  /* App Deep Link Listener */
  useEffect(() => {
    if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;

    const handleDeepLink = async (incomingUrl: string) => {
      console.log("👉 [DeepLink] Incoming URL:", incomingUrl);
      try {
        const url = new URL(incomingUrl);
        console.log("👉 [DeepLink] Parsed URL:", {
          href: url.href,
          protocol: url.protocol,
          host: url.host,
          pathname: url.pathname,
          search: url.search,
        });

        // Accept multiple callback variants from backend/frontend:
        // - socio://auth/callback?token=...&refresh_token=...
        // - socio://auth?token=...&refresh_token=...
        // - socio://callback?token=...&refresh_token=...
        const isSocioScheme = url.protocol === "socio:" || url.protocol === "socio";
        if (!isSocioScheme) {
          console.log("[DeepLink] Not a socio: scheme, ignoring.");
          return;
        }

        // Parse tokens from hash fragment (#) - used by Supabase Implicit Flow
        // Example: socio://auth/callback#access_token=...&refresh_token=...
        const hashParams = new URLSearchParams(url.hash.substring(1));

        const token = hashParams.get("access_token") || url.searchParams.get("token") || url.searchParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") || url.searchParams.get("refresh_token") || url.searchParams.get("refreshToken") || url.searchParams.get("refresh");
        const authCode = url.searchParams.get("code");
        const error = url.searchParams.get("error") || hashParams.get("error");

        if (error) {
          console.error("❌ [DeepLink] Auth error from backend:", error);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("auth_error", { detail: error }));
          }
          return;
        }

        if (token && refreshToken) {
          console.log("✅ [DeepLink] Tokens received, setting session...");

          // Try to close the browser first (best-effort), then set session.
          try {
            await Browser.close();
            console.log("✅ [DeepLink] Browser closed successfully.");
          } catch (e) {
            console.warn("[DeepLink] Browser.close() failed or not available:", e);
          }

          const { data, error: sessionErr } = await supabase.auth.setSession({
            access_token: token,
            refresh_token: refreshToken,
          });

          if (sessionErr) {
            console.error("❌ [DeepLink] setSession failed:", sessionErr.message, sessionErr);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("auth_error", { detail: sessionErr.message }));
            }
          } else {
            console.log("🎉 [DeepLink] Session set successfully for:", data.user?.email);

            // 🔍 [AuthDebug] DIRECT STATE UPDATE
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
              setIsAuthenticated(true);
              persistSessionToLS(data.session);
              scheduleTokenRefresh(data.session);
              void ensureUser(data.session.user);
              setIsLoading(false);
              console.log("🔍 [AuthDebug] Session restored. Triggering HARD RELOAD to clear stale state.");

              // FORCE RELOAD: This is the nuclear option to clear "Authenticating..." hang
              // and force the app to re-bootstrap with the new session.
              setTimeout(() => {
                window.location.reload();
              }, 500);
            }
          }
        } else if (authCode) {
          console.log("✅ [DeepLink] Auth code received, exchanging for session...");

          // IMPORTANT: Close browser BEFORE exchange to la prevent UI hanging
          try {
            await Browser.close();
          } catch (e) {
            console.warn("[DeepLink] Browser.close() failed:", e);
          }

          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(authCode);

          if (exchangeErr) {
            console.error("❌ [DeepLink] exchangeCodeForSession failed:", exchangeErr.message, exchangeErr);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("auth_error", { detail: exchangeErr.message }));
            }
          } else {
            console.log("🎉 [DeepLink] Session exchanged successfully for:", data.user?.email);

            // 🔍 [AuthDebug] DIRECT STATE UPDATE
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
              setIsAuthenticated(true);
              persistSessionToLS(data.session);
              scheduleTokenRefresh(data.session);
              void ensureUser(data.session.user);
              setIsLoading(false);
              console.log("🔍 [AuthDebug] Session exchanged. Triggering HARD RELOAD to clear stale state.");

              // FORCE RELOAD: Ensure clean slate after OAuth return
              setTimeout(() => {
                window.location.reload();
              }, 500);
            }
          }
        } else {
          console.warn("⚠️ [DeepLink] Missing tokens or code in URL params", {
            tokenPresent: !!token,
            refreshPresent: !!refreshToken,
            codePresent: !!authCode,
          });
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("auth_error", { detail: "Authentication data was missing from the callback." }));
          }
        }
      } catch (err: any) {
        console.error("❌ [DeepLink] Critical handling error:", err);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth_error", { detail: err?.message || "Critical auth error" }));
        }
      }
    };

    // Handle deep links while app is already running/in background.
    const listener = CapacitorApp.addListener("appUrlOpen", async (event) => {
      await handleDeepLink(event.url);
    });

    // Handle cold-start deep link when app was fully closed.
    void CapacitorApp.getLaunchUrl()
      .then(async (launchUrl) => {
        const url = launchUrl?.url;
        if (!url) return;
        console.log("👉 [DeepLink] Launch URL detected:", url);
        await handleDeepLink(url);
      })
      .catch((err) => {
        console.warn("[DeepLink] getLaunchUrl failed:", err);
      });


    return () => {
      listener.then(l => l.remove()).catch(() => {});
    };
  }, []);

  /* Auth state listener */
  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (typeof window === "undefined") return;

      console.log("🔍 [AuthDebug] Bootstrap: Starting sequence...");
      try {
        setAuthTimings(prev => ({ ...prev, start: Date.now() }));

        // 1. Try Supabase cookie-based session first
        const { data: { session: s } } = await supabase.auth.getSession();
        console.log(`🔍 [AuthDebug] Bootstrap getSession result: ${s ? "Session Found" : "No Session"}`);

        if (s?.user?.email) {
          if (mounted) {
            setAuthTimings(prev => ({ ...prev, sessionReady: Date.now() }));
            setSession(s);
            setUser(s.user);
            persistSessionToLS(s);
            scheduleTokenRefresh(s);
          }
          await ensureUser(s.user);
          if (mounted) {
            setIsLoading(false);
            setIsHydrated(true);
          }
          return;
        }

        // 2. Cookie session missing — try localStorage backup
        const lsSession = restoreSessionFromLS();
        const lsUser = restoreUserDataFromLS();

        if (lsSession?.refresh_token && lsSession.user) {
          console.log("🔍 [AuthDebug] Bootstrap: Restoring from LS Backup.");
          setAuthTimings(prev => ({ ...prev, sessionReady: Date.now() }));
          
          if (mounted) {
            setSession(lsSession);
            setUser(lsSession.user);
            setUserData(lsUser);
            setIsAuthenticated(true);
            if (lsUser) {
              console.log("🔍 [AuthDebug] Bootstrap: LS Profile exists, setting isAuthReady=true");
              setIsAuthReady(true);
            }
          }
          
          // Attempt a formal setSession to refresh the Supabase client state
          await supabase.auth.setSession({
            access_token: lsSession.access_token,
            refresh_token: lsSession.refresh_token,
          }).catch(() => console.warn("LS Session restoration refresh failed"));

          await ensureUser(lsSession.user);
        } else {
          // 3. No valid session anywhere
          if (mounted) {
            console.log("🔍 [AuthDebug] Bootstrap: No valid session found, clearing data.");
            persistSessionToLS(null);
            persistUserDataToLS(null);
            setUserData(null);
          }
        }
      } catch (err) {
        console.error("Auth bootstrap failed", err);
      } finally {
        if (mounted) {
          console.log("🔍 [AuthDebug] Bootstrap: Completed.");
          setIsLoading(false);
          setIsHydrated(true);
        }
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      console.log(`🔍 [AuthDebug] onAuthStateChange: Event=${event}, SessionPresent=${!!s}`);

      setSession(s);
      setUser(s?.user ?? null);
      persistSessionToLS(s);
      scheduleTokenRefresh(s);

      if (s?.user?.email) {
        console.log(`🔍 [AuthDebug] onAuthStateChange: User authenticated. Waiting for Profile Hydration.`);
        setAuthTimings(prev => ({ ...prev, sessionReady: Date.now() }));
        void ensureUser(s.user);
        setIsLoading(false);
        setIsHydrated(true);
      } else {
        console.log(`🔍 [AuthDebug] onAuthStateChange: No session. Clearing data.`);
        setUserData(null);
        persistUserDataToLS(null);
        setIsLoading(false);
        setIsHydrated(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [ensureUser, scheduleTokenRefresh]);

  /* Actions */
  const signInWithGoogle = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Aggressive Native Check
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    const isApp = isNative || platform === "android" || platform === "ios";
    const currentOrigin = window.location.origin;
    
    console.log("🔍 [AuthDebug] Full Platform Analysis:", {
      isAppResult: isApp,
      isNativePlatform: isNative,
      getPlatform: platform,
      userAgent: navigator.userAgent,
      origin: currentOrigin,
      location: window.location.href
    });

    if (isApp) {
      console.log("🚀 [AuthDebug] >>> EXECUTING NATIVE AUTH BRANCH <<<");
      console.log("📍 [AuthDebug] Forced Redirect: socio://auth/callback");
      await signInWithGoogleNative();
    } else {
      console.log("🌐 [AuthDebug] >>> EXECUTING WEB AUTH BRANCH <<<");
      console.log("📍 [AuthDebug] Origin-based Redirect Target Selected");
      await signInWithGoogleWeb();
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setUserData(null);
    persistSessionToLS(null);
    persistUserDataToLS(null);
  }, []);

  const needsCampus =
    !isLoading &&
    !!userData &&
    userData.organization_type === "christ_member" &&
    !userData.campus;

  return (
    <AuthContext.Provider
      value={{ 
        session, 
        user, 
        userData, 
        isLoading: !isHydrated || isLoading, 
        isAuthReady,
        isAuthenticated, 
        needsCampus, 
        signInWithGoogle, 
        signOut, 
        refreshUserData 
      }}
    >
      {children}
      
      {/* 🛠️ [DEBUG OVERLAY] - Temporary floating state indicator */}
      {process.env.NODE_ENV === "development" && (
        <div 
          className="fixed bottom-24 right-4 z-[9999] p-2 bg-black/80 text-[10px] text-white rounded-lg pointer-events-none border border-white/20 font-mono"
          style={{ maxWidth: "200px" }}
        >
          <div className="flex justify-between border-b border-white/10 pb-1 mb-1">
            <span className="text-blue-400">AUTH DEBUG</span>
            <span className={isAuthenticated ? "text-green-400" : "text-red-400"}>
              {isAuthenticated ? "AUTH" : "GUEST"}
            </span>
          </div>
          <div className="truncate">U: {user?.email || "none"}</div>
          <div className="truncate">P: {userData?.name || "null"}</div>
          <div className="truncate">L: {isLoading ? "loading..." : "idle"}</div>
          <div className="truncate">T: {session?.access_token ? "OK" : "MISSING"}</div>
        </div>
      )}

      {showOutsiderWarning && outsiderVisitorId && userData && (
        <div className="modal-backdrop">
          <div className="modal-card overflow-hidden">
            <div className="bg-[var(--color-primary-dark)] px-5 py-4">
              <h3 className="text-lg font-bold text-white">Welcome, Visitor</h3>
              <p className="text-blue-100 text-xs mt-0.5">External visitor access</p>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-[var(--color-primary-dark)] px-4 py-3">
                <span className="text-xs text-blue-100">Visitor ID</span>
                <span className="text-base font-bold text-[var(--color-accent)] tracking-wider">
                  {outsiderVisitorId}
                </span>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Please confirm your display name before continuing. Visitor profiles can update it only once.
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-[var(--color-text-light)] mb-1">Display Name</p>
                    {!isEditingOutsiderName ? (
                      <p className="text-sm font-semibold text-[var(--color-primary-dark)] truncate">
                        {userData.name || session?.user?.user_metadata?.full_name || "--"}
                      </p>
                    ) : (
                      <input
                        type="text"
                        value={outsiderNameInput}
                        onChange={(e) => setOutsiderNameInput(e.target.value)}
                        className="input w-full text-sm"
                        placeholder="Enter your name"
                        autoFocus
                      />
                    )}
                  </div>
                  {!isEditingOutsiderName && !isSavingOutsiderName && (
                    <button
                      onClick={() => {
                        setOutsiderNameInput(userData.name || session?.user?.user_metadata?.full_name || "");
                        setIsEditingOutsiderName(true);
                        setOutsiderNameError(null);
                      }}
                      className="text-[var(--color-primary)] text-xs font-semibold shrink-0"
                    >
                      Change Name
                    </button>
                  )}
                </div>
              </div>

              {outsiderNameError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-red-700 text-xs text-center">{outsiderNameError}</p>
                </div>
              )}

              {!isEditingOutsiderName ? (
                <button
                  onClick={() => saveOutsiderName(userData.name || session?.user?.user_metadata?.full_name || "")}
                  disabled={isSavingOutsiderName}
                  className="btn btn-primary w-full"
                >
                  {isSavingOutsiderName ? "Saving..." : "Name Is Correct, Continue"}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditingOutsiderName(false);
                      setOutsiderNameError(null);
                    }}
                    disabled={isSavingOutsiderName}
                    className="btn btn-ghost flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!outsiderNameInput.trim()) {
                        setOutsiderNameError(getFriendlyOutsiderNameError("Name cannot be empty"));
                        return;
                      }
                      saveOutsiderName(outsiderNameInput);
                    }}
                    disabled={isSavingOutsiderName}
                    className="btn btn-primary flex-1"
                  >
                    {isSavingOutsiderName ? "Saving..." : "Save Name"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}
