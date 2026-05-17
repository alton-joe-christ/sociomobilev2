"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { apiRequest } from "@/lib/apiClient";
import { startPerfSpan } from "@/lib/capacitorPerfAudit";
import { initOneSignal } from "@/lib/onesignal";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  eventId: string | null;
  eventTitle: string | null;
  read: boolean;
  createdAt: string;
  actionUrl: string | null;
  isBroadcast: boolean;
}

type PushStatus = "not_requested" | "granted" | "denied";
export type NotificationPromptStatus = "not_shown" | "shown" | "accepted" | "denied";

interface NotifCtx {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  pushStatus: PushStatus;
  promptStatus: NotificationPromptStatus;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  refresh: () => void;
  hasMore: boolean;
  loadMore: () => void;
  enablePushNotifications: () => Promise<void>;
  updatePromptStatus: (status: NotificationPromptStatus) => void;
  triggerPrompt: () => void;
}

const NotifContext = createContext<NotifCtx>({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  pushStatus: "not_requested",
  promptStatus: "not_shown",
  markRead: () => {},
  markAllRead: () => {},
  dismiss: () => {},
  dismissAll: () => {},
  refresh: () => {},
  hasMore: false,
  loadMore: () => {},
  enablePushNotifications: async () => {},
  updatePromptStatus: () => {},
  triggerPrompt: () => {},
});

export const useNotifications = () => useContext(NotifContext);

/* ── Helpers for Local State Persistence ── */
const LS_READ_KEY = "socio_read_notifications";
const LS_DISMISSED_KEY = "socio_dismissed_notifications";
const LS_PUSH_STATUS_KEY = "socio_push_status";

function getLocalSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  const raw = localStorage.getItem(key);
  return new Set(raw ? JSON.parse(raw) : []);
}

function saveLocalSet(key: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

function urlBase64ToUint8Array(base64String: string) {
  if (typeof window === "undefined") return new Uint8Array();
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { userData, isAuthReady } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("not_requested");
  const [promptStatus, setPromptStatus] = useState<NotificationPromptStatus>("not_shown");
  const [oneSignal, setOneSignal] = useState<any>(null);
  const router = useRouter();

  const LS_PROMPT_STATUS_KEY = "socio_notification_prompt_status";

  // Track page in a ref to avoid making it a reactive dep of fetchNotifications
  const pageRef = useRef(1);
  const [hasMore, setHasMore] = useState(true);

  // Load initial status
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pStatus = localStorage.getItem(LS_PUSH_STATUS_KEY) as PushStatus;
    if (pStatus) setPushStatus(pStatus);

    const prStatus = localStorage.getItem(LS_PROMPT_STATUS_KEY) as NotificationPromptStatus;
    if (prStatus) setPromptStatus(prStatus);
  }, []);

  const updatePromptStatus = useCallback((status: NotificationPromptStatus) => {
    setPromptStatus(status);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_PROMPT_STATUS_KEY, status);
    }
  }, []);

  const triggerPrompt = useCallback(() => {
    if (promptStatus === "accepted" || promptStatus === "denied") return;
    updatePromptStatus("shown");
  }, [promptStatus, updatePromptStatus]);

  // 1. OneSignal Initialization
  //    • Web/PWA  → lib/onesignal.ts handles web push (guarded, de-duped)
  //    • Native   → Cordova plugin handles push; attach listeners only
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Web push init — all guards live inside initOneSignal()
    initOneSignal();

    // Native-only: attach Cordova notification listeners
    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
          if (!appId || appId === "placeholder_onesignal_id_here") return;

          const OS = (await import("onesignal-cordova-plugin")).default;
          OS.initialize(appId);

          if (OS.Notifications) {
            OS.Notifications.addEventListener("click", (event: any) => {
              const route =
                event.notification.additionalData?.route ||
                event.notification.additionalData?.actionUrl;
              router.push(route || "/notifications");
            });
            OS.Notifications.addEventListener("foregroundWillDisplay", (event: any) => {
              event.preventDefault();
              const n = event.notification;
              toast.success(`${n.title}: ${n.body}`, { duration: 5000, position: "top-center" });
            });
          }

          setOneSignal(OS);
          console.log("[OneSignal] Native Cordova listeners attached");
        } catch (e) {
          console.error("[OneSignal] Native init error", e);
        }
      })();
    }
  }, [router]);

  // Sync User Tags (Web & Native)
  useEffect(() => {
    if (oneSignal && userData?.email) {
      try {
        const externalId = userData.email.toLowerCase();
        oneSignal.login(externalId);
        oneSignal.User.addTags({
          department: userData.department || "none",
          campus: userData.campus || "none",
          email: externalId
        });
      } catch (e) {
        console.warn("OneSignal identity sync failed", e);
      }
    } else if (oneSignal && !userData?.email) {
      try {
        oneSignal.logout();
      } catch {}
    }
  }, [userData, oneSignal]);

  const enablePushNotifications = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      let granted = false;

      if (Capacitor.isNativePlatform()) {
        // Native: use the Cordova OS instance stored in state
        if (!oneSignal) return;
        granted = await oneSignal.Notifications.requestPermission(true);
      } else {
        // Web/PWA: use the global OneSignal object exposed by react-onesignal
        const OS = (await import("react-onesignal")).default;
        if (!OS?.Notifications) {
          console.warn("[OneSignal] Web SDK not fully initialized");
          return;
        }
        await OS.Notifications.requestPermission();
        granted =
          OS.Notifications.permission === true ||
          Notification.permission === "granted";
        if (granted) console.log("[OneSignal] Permission granted");
      }

      const newStatus = granted ? "granted" : "denied";
      setPushStatus(newStatus);
      localStorage.setItem(LS_PUSH_STATUS_KEY, newStatus);
      updatePromptStatus(granted ? "accepted" : "denied");

      if (granted) {
        toast.success("Notifications enabled!");
        console.log("[OneSignal] Subscription active");
      }
    } catch (e) {
      console.error("[OneSignal] Push enable error", e);
    }
  }, [oneSignal, updatePromptStatus]);

  /* ── Fetch notifications ──────────────────────────────────────────────
   * IMPORTANT: `unreadCount` and `page` are intentionally NOT in the dep
   * array. Reading them via functional setState or pageRef prevents the
   * callback reference from changing on every render, which previously
   * caused an infinite fetch loop:
   *   fetch → setUnreadCount → new callback ref → effect re-runs → fetch …
   * ─────────────────────────────────────────────────────────────────── */
  const fetchNotifications = useCallback(async (isLoadMore = false) => {
    if (!userData?.email) return;
    const endSpan = startPerfSpan("notifications.fetch", { isLoadMore });
    setIsLoading(true);

    const targetPage = isLoadMore ? pageRef.current + 1 : 1;

    const platform = Capacitor.getPlatform();
    console.log(`[API] endpoint: /notifications, platform: ${platform}`);

    try {
      const data: any = await apiRequest(
        `/notifications?email=${encodeURIComponent(userData.email)}&page=${targetPage}&limit=15`,
        { cache: "no-store" }
      );
      
      const raw = (data.notifications || []) as Notification[];

        const readSet = getLocalSet(LS_READ_KEY);
        const dismissedSet = getLocalSet(LS_DISMISSED_KEY);

        const processed = raw
          .filter(n => !dismissedSet.has(n.id))
          .map(n => ({
            ...n,
            read: n.read || readSet.has(n.id)
          }));

        if (isLoadMore) {
          setNotifications(prev => [...prev, ...processed]);
          pageRef.current = targetPage;
        } else {
          setNotifications(processed);
          pageRef.current = 1;
          // Functional update: avoids reading stale unreadCount in deps
          setUnreadCount(processed.filter(n => !n.read).length);
        }

        setHasMore(raw.length === 15);
    } catch (err) {
      console.error("Fetch error", err);
    }
    setIsLoading(false);
    endSpan({ status: "completed" });
  // Stable deps: only email and token. page is tracked via pageRef.
  // unreadCount is updated via functional setState — never read here.
  }, [userData?.email]);

  /* ── Stable fetch ref: the polling interval always calls the latest
   * version of fetchNotifications without needing to recreate the interval
   * every time the callback reference changes. ── */
  const fetchRef = useRef(fetchNotifications);
  useEffect(() => {
    fetchRef.current = fetchNotifications;
  }, [fetchNotifications]);

  /* ── Polling effect ───────────────────────────────────────────────────
   * Only re-runs when the user's email/token changes (login/logout).
   * The interval is set once and calls fetchRef.current, which always
   * points to the latest callback. This eliminates the previous bug where
   * the interval was recreated on every fetch cycle.
   * ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isAuthReady || !userData?.email) return;
    fetchRef.current();
    const timer = setInterval(() => fetchRef.current(), 60000);
    return () => clearInterval(timer);
  }, [userData?.email]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchRef.current(true);
    }
  }, [isLoading, hasMore]);

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));

    // Local persistence
    const set = getLocalSet(LS_READ_KEY);
    set.add(id);
    saveLocalSet(LS_READ_KEY, set);

    // Backend sync (best effort)
    if (userData?.email) {
      apiRequest(`/notifications/${id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userData.email }),
      }).catch(() => {});
    }
  }, [userData?.email]);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);

    const set = getLocalSet(LS_READ_KEY);
    notifications.forEach(n => set.add(n.id));
    saveLocalSet(LS_READ_KEY, set);

    if (userData?.email) {
      apiRequest(`/notifications/mark-read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userData.email }),
      }).catch(() => {});
    }
  }, [notifications, userData?.email]);

  const dismiss = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    const set = getLocalSet(LS_DISMISSED_KEY);
    set.add(id);
    saveLocalSet(LS_DISMISSED_KEY, set);

    if (userData?.email) {
      apiRequest(`/notifications/${encodeURIComponent(id)}?email=${encodeURIComponent(userData.email)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  }, [userData?.email]);

  const dismissAll = useCallback(async () => {
    const ids = notifications.map(n => n.id);
    setNotifications([]);
    setUnreadCount(0);

    const set = getLocalSet(LS_DISMISSED_KEY);
    ids.forEach(id => set.add(id));
    saveLocalSet(LS_DISMISSED_KEY, set);

    if (userData?.email) {
      apiRequest(`/notifications?email=${encodeURIComponent(userData.email)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  }, [notifications, userData?.email]);

  const contextValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      pushStatus,
      promptStatus,
      markRead,
      markAllRead,
      dismiss,
      dismissAll,
      refresh: () => fetchRef.current(),
      hasMore,
      loadMore,
      enablePushNotifications,
      updatePromptStatus,
      triggerPrompt,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      pushStatus,
      promptStatus,
      markRead,
      markAllRead,
      dismiss,
      dismissAll,
      hasMore,
      loadMore,
      enablePushNotifications,
      updatePromptStatus,
      triggerPrompt,
    ]
  );

  return (
    <NotifContext.Provider value={contextValue}>
      {children}
    </NotifContext.Provider>
  );
}
