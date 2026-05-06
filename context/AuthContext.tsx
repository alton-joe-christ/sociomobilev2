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
    console.log(`fetchUserData called for ${email}, accessToken present: ${!!accessToken}, attempt: ${retryCount + 1}`);
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const res = await fetch(
        accessToken ? `${PWA_API_URL}/users/me` : `${PWA_API_URL}/users/${encodeURIComponent(email)}`,
        {
          headers,
          cache: "no-store",
        }
      );
      if (res.ok) {
        const data = await res.json();
        const fetchedUser = data.user ?? data;
        fetchedUser.roles = fetchedUser.roles ?? data.roles ?? {};
        
        // Derive catering role from caters array - must have at least one entry with is_catering: true
        if (fetchedUser.caters && fetchedUser.caters.some((c: any) => c.is_catering)) {
          fetchedUser.roles.catering = true;
        }

        // Only retain volunteer and catering roles for mobile
        fetchedUser.roles = {
          catering: fetchedUser.roles.catering,
          // volunteer role is determined by volunteerEvents presence
        };

        let volEvents = Array.isArray(fetchedUser.volunteerEvents)
          ? fetchedUser.volunteerEvents
          : Array.isArray(data.volunteerEvents)
            ? data.volunteerEvents
            : undefined;

        // If volunteerEvents is undefined (not provided by backend), try fetching from the dedicated endpoint
        if (volEvents === undefined && accessToken) {
          try {
            const volRes = await fetch(`${PWA_API_URL}/volunteer/events`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              cache: "no-store",
            });
            if (volRes.ok) {
              const volData = await volRes.json();
              volEvents = volData.events || [];
            } else {
              volEvents = [];
            }
          } catch (err) {
            console.error("Failed to fetch volunteer events during /me fetch", err);
            volEvents = [];
          }
        }
        
        fetchedUser.volunteerEvents = volEvents || [];

        console.log(`User fetched via /me. Volunteer events count: ${fetchedUser.volunteerEvents?.length || 0}`);
        setUserData(fetchedUser);
        persistUserDataToLS(fetchedUser);
        return fetchedUser;
      }

      // Fallback: If /me failed (404), try fetching by email directly
      if (res.status === 404 && accessToken && email) {
        console.log(`Profile not found via token, trying email fallback for: ${email}`);
        const fallbackRes = await fetch(`${PWA_API_URL}/users/${encodeURIComponent(email)}`, {
          cache: "no-store",
        });
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          console.log(`Fallback user data keys: ${Object.keys(data).join(", ")}`);
          if (data.user) console.log(`Fallback data.user keys: ${Object.keys(data.user).join(", ")}`);
          const fetchedUser = data.user ?? data;
          console.log(`Volunteer events raw data: ${JSON.stringify(data.volunteerEvents || [])}`);
          fetchedUser.roles = fetchedUser.roles ?? data.roles ?? {};

          // Derive catering role from caters array - must have at least one entry with is_catering: true
          if (fetchedUser.caters && fetchedUser.caters.some((c: any) => c.is_catering)) {
            fetchedUser.roles.catering = true;
          }

          // Only retain volunteer and catering roles for mobile
          fetchedUser.roles = {
            catering: fetchedUser.roles.catering,
            // volunteer role is determined by volunteerEvents presence
          };

          let fallbackVolEvents = Array.isArray(fetchedUser.volunteerEvents)
            ? fetchedUser.volunteerEvents
            : Array.isArray(data.volunteerEvents)
              ? data.volunteerEvents
              : undefined;

          // If volunteerEvents is undefined, try fetching from the dedicated endpoint
          if (fallbackVolEvents === undefined) {
            try {
              // Try token-based first if we have one
              let volData: any = null;
              if (accessToken) {
                const volRes = await fetch(`${PWA_API_URL}/volunteer/events`, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                  cache: "no-store",
                });
                if (volRes.ok) {
                  volData = await volRes.json();
                }
              }

              // If token-based failed or returned empty, try email-based fallback
              if (!volData || !volData.events) {
                console.log(`Trying email-based volunteer fetch for ${email}`);
                const emailVolRes = await fetch(`${PWA_API_URL}/volunteer/events?email=${encodeURIComponent(email)}`, {
                  cache: "no-store",
                });
                if (emailVolRes.ok) {
                  volData = await emailVolRes.json();
                }
              }

              fallbackVolEvents = volData?.events || [];
            } catch (err) {
              console.error("Failed to fetch volunteer events during fallback", err);
              fallbackVolEvents = [];
            }
          }
          
          fetchedUser.volunteerEvents = fallbackVolEvents || [];

          console.log(`User fetched via fallback. Volunteer events count: ${fetchedUser.volunteerEvents?.length || 0}`);
          setUserData(fetchedUser);
          persistUserDataToLS(fetchedUser);
          return fetchedUser;
        }
      }
    } catch (e) {
      console.error("Failed to fetch user data", e);
    }

    if (retryCount < 2) {
      console.log(`Retrying fetchUserData (${retryCount + 1})...`);
      await new Promise(r => setTimeout(r, 2000));
      return fetchUserDataInternal(email, accessToken, retryCount + 1);
    }

    return null;
  }, [PWA_API_URL]);

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
      const orgType = getOrgType(email);
      let fullName =
        supaUser.user_metadata?.full_name ||
        supaUser.user_metadata?.name ||
        "";
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

        await fetch(`${PWA_API_URL}/users`, {
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
      } catch (err) {
        console.error("ensureUser failed:", err);
      }

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const fetchedUser = await fetchUserData(email, currentSession?.access_token);
      maybeShowOutsiderWelcome(fetchedUser, supaUser.id);
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

    const listener = CapacitorApp.addListener("appUrlOpen", async (event) => {
      try {
        const url = new URL(event.url);
        if (url.protocol === "socio:" && url.pathname.includes("/callback")) {
          const token = url.searchParams.get("token");
          const refreshToken = url.searchParams.get("refresh_token");
          
          if (token && refreshToken) {
            await Browser.close().catch(() => {});
            
            await supabase.auth.setSession({
              access_token: token,
              refresh_token: refreshToken,
            });
          }
        }
      } catch (err) {
        console.error("Error handling deep link", err);
      }
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

      try {
        const cachedUser = restoreUserDataFromLS();
        if (cachedUser && mounted) {
          setUserData({
            ...cachedUser,
            volunteerEvents: Array.isArray(cachedUser.volunteerEvents) ? cachedUser.volunteerEvents : [],
          });
        }

        // 1. Try Supabase cookie-based session first
        const { data: { session: s } } = await supabase.auth.getSession();

        if (s?.user?.email) {
          if (mounted) {
            setSession(s);
            setUser(s.user);
            persistSessionToLS(s);
            scheduleTokenRefresh(s);
          }
          void ensureUser(s.user);
          if (mounted) setIsLoading(false);
          return;
        }

        // 2. Cookie session missing — try localStorage backup (PWA standalone)
        const lsSession = restoreSessionFromLS();
        if (lsSession?.refresh_token) {
          const { data: refreshed } = await supabase.auth.setSession({
            access_token: lsSession.access_token,
            refresh_token: lsSession.refresh_token,
          });

          if (refreshed.session?.user?.email && mounted) {
            setSession(refreshed.session);
            setUser(refreshed.session.user);
            persistSessionToLS(refreshed.session);
            scheduleTokenRefresh(refreshed.session);
            void ensureUser(refreshed.session.user);
            return;
          }
        }

        // 3. No valid session anywhere
        if (mounted) {
          persistSessionToLS(null);
          persistUserDataToLS(null);
          setUserData(null);
        }
      } catch (err) {
        console.error("Auth bootstrap failed", err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      persistSessionToLS(s);
      scheduleTokenRefresh(s);

      if (s?.user?.email) {
        void ensureUser(s.user);
        setIsLoading(false);
      } else {
        setUserData(null);
        persistUserDataToLS(null);
        setIsLoading(false);
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
    const isApp = typeof window !== "undefined" && Capacitor.isNativePlatform();
    const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    const redirectUrl = isApp ? `${runtimeOrigin}/auth/callback?source=capacitor` : `${runtimeOrigin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { 
        redirectTo: redirectUrl,
        skipBrowserRedirect: isApp 
      },
    });

    if (error) {
      console.error("Google sign-in error", error);
      throw error;
    }

    if (isApp && data?.url) {
      try {
        await Browser.open({ url: data.url });
      } catch (browserErr: any) {
        console.warn("Browser.open failed, falling back to window.location redirect:", browserErr);
        // Plugin not installed or app not rebuilt after cap sync —
        // fall back to a normal redirect so the user can still sign in.
        if (typeof window !== "undefined") {
          window.location.href = data.url;
        }
      }
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
      value={{ session, user, userData, isLoading, needsCampus, signInWithGoogle, signOut, refreshUserData }}
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
