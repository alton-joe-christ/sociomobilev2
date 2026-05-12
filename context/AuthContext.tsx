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
import { emitAuthTransition } from "@/lib/nativeLaunchState";
import { logCapacitorPerfAudit, startPerfSpan, withPerfSpan } from "@/lib/capacitorPerfAudit";

/* ── Local-storage helpers for PWA session persistence ── */
const LS_SESSION_KEY = "socio_pwa_session";
const LS_USER_KEY = "socio_pwa_user_data";
// Set on first successful user provision — prevents redundant POST /users on every session restore
const USER_PROVISIONED_KEY = "socio_user_provisioned";

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
      // Lightweight Local Profile Snapshot Optimization
      // Do not store large nested arrays like volunteerEvents to save parse time.
      const snapshot: Partial<UserData> = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        campus: user.campus,
        roles: user.roles,
        department: user.department,
        organization_type: user.organization_type,
        visitor_id: user.visitor_id,
        register_number: user.register_number,
      };
      localStorage.setItem(LS_USER_KEY, JSON.stringify(snapshot));
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
  // isAuthenticated is derived — no state, no extra rerender
  const [isAuthReady, setIsAuthReady] = useState(false);
  // Timing tracked via ref — zero rerenders
  const authTimingsRef = useRef({ start: 0, sessionReady: 0, profileReady: 0 });
  
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
  const fetchUserData = useCallback(async function fetchUserDataInternal(email: string, retryCount = 0): Promise<UserData | null> {
    const platform = Capacitor.getPlatform();
    const endSpan = startPerfSpan("auth.fetch-user-data", { email, retryCount, platform });

    // Abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout protection

    try {
      const [meRes, volRes] = await Promise.allSettled([
        apiRequest(`/users/me`, { cache: "no-store", signal: controller.signal }),
        apiRequest(`/volunteer/events`, { cache: "no-store", signal: controller.signal })
      ]);
      
      clearTimeout(timeoutId);

      if (meRes.status === "rejected") {
        throw meRes.reason;
      }

      const data = meRes.value as any;
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

      if (volEvents === undefined) {
        if (volRes.status === "fulfilled") {
          volEvents = (volRes.value as any).events || [];
        } else {
          console.error("Failed to fetch volunteer events during /me fetch", volRes.reason);
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
      endSpan({ status: "completed" });
    }

    if (retryCount < 2) {
      console.log(`🔍 [AuthDebug] fetchUserData: Retrying (${retryCount + 1})...`);
      await new Promise(r => setTimeout(r, 2000));
      return fetchUserDataInternal(email, retryCount + 1);
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
    if (user?.email) await fetchUserData(user.email);
  }, [fetchUserData, user?.email]);

  const hydrationPromiseRef = useRef<Promise<void> | null>(null);

  const ensureUser = useCallback(
    async (supaUser: User) => {
      const email = supaUser.email!;
      
      // Atomic Synchronization Lock
      if (hydrationPromiseRef.current) {
        logCapacitorPerfAudit("auth.ensure-user.waiting-lock", { email });
        await hydrationPromiseRef.current;
        return;
      }

      let resolveLock: (() => void) | null = null;
      hydrationPromiseRef.current = new Promise<void>((resolve) => {
        resolveLock = resolve;
      });

      const endEnsureUserSpan = startPerfSpan("auth.ensure-user", { email });

      try {
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
          const alreadyProvisioned =
            typeof window !== "undefined" && localStorage.getItem(USER_PROVISIONED_KEY);
          if (!alreadyProvisioned) {
            await withPerfSpan("auth.ensure-user.provision", async () => {
              await apiRequest(`/users`, {
                method: "POST",
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
            }, { email });

            if (typeof window !== "undefined") {
              localStorage.setItem(USER_PROVISIONED_KEY, "1");
            }
          }
        } catch (err) {
          console.error("🔍 [AuthDebug] ensureUser: Setup error:", err);
          // Don't set provisioned flag on failure — will retry next time
        }

        const fetchedUser = await fetchUserData(email);
        
        if (fetchedUser) {
          authTimingsRef.current.profileReady = Date.now();
          setIsAuthReady(true);
          maybeShowOutsiderWelcome(fetchedUser, supaUser.id);
        } else {
          console.warn(`🔍 [AuthDebug] ensureUser: Profile fetch failed. USING FALLBACK HYDRATION.`);
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
          authTimingsRef.current.profileReady = Date.now();
          setIsAuthReady(true);
        }
      } finally {
        endEnsureUserSpan({ status: "completed" });
        hydrationPromiseRef.current = null;
        resolveLock?.();
      }
    },
    [fetchUserData, maybeShowOutsiderWelcome]
  );

  const saveOutsiderName = useCallback(
    async (name: string) => {
      if (!userData?.email || !outsiderVisitorId) return;

      setIsSavingOutsiderName(true);
      setOutsiderNameError(null);
      try {
        await apiRequest(`/users/${encodeURIComponent(userData.email)}/name`, {
          method: "PUT",
          body: JSON.stringify({
            name: name.trim(),
            visitor_id: outsiderVisitorId,
          }),
        });

        setShowOutsiderWarning(false);
        setIsEditingOutsiderName(false);
        await fetchUserData(userData.email);
      } catch (err: any) {
        setOutsiderNameError(getFriendlyOutsiderNameError(err.message || "Network error"));
      } finally {
        setIsSavingOutsiderName(false);
      }
    },
    [fetchUserData, outsiderVisitorId, userData?.email]
  );

  /* Note: Background 60-second role refresh was removed for mobile to ensure it only fetches once */

  /* Auth state listener */
  useEffect(() => {
    let mounted = true;
    const isProcessingDeepLink = { current: false };

    async function handleDeepLink(incomingUrl: string) {
      const now = Date.now();
      console.log(`🔍 [AuthRaceDebug] ${now} [DeepLink] Received: ${incomingUrl}`);
      const endDeepLinkSpan = startPerfSpan("auth.handle-deeplink", { incomingUrl });
      isProcessingDeepLink.current = true;
      setIsLoading(true);

      try {
        const url = new URL(incomingUrl);
        const isSocioScheme = url.protocol === "socio:" || url.protocol === "socio";
        if (!isSocioScheme) {
          console.log(`🔍 [AuthRaceDebug] ${Date.now()} [DeepLink] Non-socio scheme. Ignoring.`);
          isProcessingDeepLink.current = false;
          if (mounted) setIsLoading(false);
          return;
        }

        const hashParams = new URLSearchParams(url.hash.substring(1));
        const token = hashParams.get("access_token") || url.searchParams.get("token") || url.searchParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") || url.searchParams.get("refresh_token") || url.searchParams.get("refreshToken") || url.searchParams.get("refresh");
        const authCode = url.searchParams.get("code");
        const error = url.searchParams.get("error") || hashParams.get("error");

        if (error) {
          console.error(`🔍 [AuthRaceDebug] ${Date.now()} [DeepLink] Error:`, error);
          isProcessingDeepLink.current = false;
          setIsLoading(false);
          return;
        }

        if (token && refreshToken) {
          console.log(`🔍 [AuthRaceDebug] ${Date.now()} [DeepLink] Tokens found. Starting setSession...`);
          try { await Browser.close(); } catch {}

          const { data, error: sessionErr } = await supabase.auth.setSession({
            access_token: token,
            refresh_token: refreshToken,
          });

          if (sessionErr) {
            console.error(`🔍 [AuthRaceDebug] ${Date.now()} [DeepLink] setSession FAIL:`, sessionErr.message);
          } else if (data.session) {
            console.log(`🔍 [AuthRaceDebug] ${Date.now()} [DeepLink] setSession SUCCESS for: ${data.user?.email}`);
            setSession(data.session);
            setUser(data.session.user);
            persistSessionToLS(data.session);
            await ensureUser(data.session.user);
          }
        } else if (authCode) {
          console.log(`🔍 [AuthRaceDebug] ${Date.now()} [DeepLink] Code found. Starting exchange...`);
          try { await Browser.close(); } catch {}

          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(authCode);

          if (exchangeErr) {
            console.error(`🔍 [AuthRaceDebug] ${Date.now()} [DeepLink] Exchange FAIL:`, exchangeErr.message);
          } else if (data.session) {
            console.log(`🔍 [AuthRaceDebug] ${Date.now()} [DeepLink] Exchange SUCCESS for: ${data.user?.email}`);
            setSession(data.session);
            setUser(data.session.user);
            persistSessionToLS(data.session);
            await ensureUser(data.session.user);
          }
        }
      } catch (err: any) {
        console.error(`🔍 [AuthRaceDebug] ${Date.now()} [DeepLink] CRITICAL:`, err);
      } finally {
        endDeepLinkSpan({ status: "completed" });
        isProcessingDeepLink.current = false;
        if (mounted) setIsLoading(false);
      }
    }

    async function bootstrap() {
      if (typeof window === "undefined") return;

      const endBootstrapSpan = startPerfSpan("auth.bootstrap");
      try {
        authTimingsRef.current.start = Date.now();

        // 1. Restore from LS Backup (OPTIMISTIC)
        const lsSession = restoreSessionFromLS();
        const lsUser = restoreUserDataFromLS();
        
        if (lsSession?.user) {
          console.log(`🔍 [AuthRaceDebug] ${Date.now()} Bootstrap: Optimistic LS Restore.`);
          setSession(lsSession);
          setUser(lsSession.user);
          setUserData(lsUser);
          authTimingsRef.current.sessionReady = Date.now();
          // If we have a user name, mark auth ready for basic UI
          if (lsUser?.name) setIsAuthReady(true);
          // Unlock UI early
          setIsLoading(false);
          setIsHydrated(true);
        }

        // 2. Parallel Session & Deep Link check
        const [sessionResult, launchUrl] = await Promise.all([
          supabase.auth.getSession(),
          Capacitor.isNativePlatform() ? CapacitorApp.getLaunchUrl() : Promise.resolve(null)
        ]);

        // 3. Handle Deep Link Priority
        if (launchUrl?.url) {
          console.log(`🔍 [AuthRaceDebug] ${Date.now()} Bootstrap: Cold start deep link: ${launchUrl.url}`);
          await handleDeepLink(launchUrl.url);
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s) {
            console.log(`🔍 [AuthRaceDebug] ${Date.now()} Bootstrap: Deep link hydration successful.`);
            return;
          }
        }

        const s = sessionResult.data.session;
        console.log(`🔍 [AuthRaceDebug] ${Date.now()} Bootstrap: getSession result: ${s ? "Session Found" : "No Session"}`);

        if (s?.user?.email) {
          if (mounted) {
            authTimingsRef.current.sessionReady = Date.now();
            setSession(s);
            setUser(s.user);
            persistSessionToLS(s);
            scheduleTokenRefresh(s);
            // Unlock UI if not already unlocked
            setIsLoading(false);
            setIsHydrated(true);
          }
          // Profile hydration happens in background
          ensureUser(s.user);
          return;
        }

        // If no session found and not restored from LS
        if (!lsSession && mounted) {
          persistSessionToLS(null);
          persistUserDataToLS(null);
          setUserData(null);
        }
      } catch (err) {
        console.error("Auth bootstrap failed", err);
      } finally {
        endBootstrapSpan({ status: "completed" });
        if (mounted) {
          console.log(`🔍 [AuthRaceDebug] ${Date.now()} Bootstrap: Sequence finished.`);
          setIsLoading(false);
          setIsHydrated(true);
        }
      }
    }

    bootstrap();

    // Listener for links while app is running
    let appUrlListener: any;
    if (Capacitor.isNativePlatform()) {
      appUrlListener = CapacitorApp.addListener("appUrlOpen", async (event) => {
        await handleDeepLink(event.url);
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;
      console.log(`🔍 [AuthRaceDebug] ${Date.now()} onAuthStateChange: Event=${event}, SessionPresent=${!!s}`);
      logCapacitorPerfAudit("auth.state-change", { event, sessionPresent: !!s });
      emitAuthTransition(event, event === "SIGNED_OUT" ? "Switching profiles…" : event === "SIGNED_IN" ? "Restoring profile…" : "Refreshing session…");

      setSession(s);
      setUser(s?.user ?? null);
      persistSessionToLS(s);
      scheduleTokenRefresh(s);

      if (s?.user?.email) {
        if (event === "SIGNED_IN") {
          // Fresh login — unlock UI immediately, hydrate profile in background
          if (mounted) {
            setIsLoading(false);
            setIsHydrated(true);
          }
          void ensureUser(s.user);
        } else if (event === "INITIAL_SESSION") {
          // Session restore (every page load / app resume) — NEVER block UI
          // bootstrap() has already unlocked the UI via LS restore.
          // Just fire background hydration.
          void ensureUser(s.user);
          if (mounted) {
            setIsLoading(false);
            setIsHydrated(true);
          }
        } else {
          void ensureUser(s.user);
          if (mounted) {
            setIsLoading(false);
            setIsHydrated(true);
          }
        }
      } else if (event === "SIGNED_OUT") {
        setUserData(null);
        setIsAuthReady(false);
        persistUserDataToLS(null);
        if (mounted) {
          setIsLoading(false);
          setIsHydrated(true);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (appUrlListener) appUrlListener.then((l: any) => l.remove());
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
    emitAuthTransition("SIGN_OUT_REQUESTED", "Switching profiles…");
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setUserData(null);
    persistSessionToLS(null);
    persistUserDataToLS(null);
  }, []);

  // Derived — no state needed, no extra rerender
  const isAuthenticated = !!user;

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
