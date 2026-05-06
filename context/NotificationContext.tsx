"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { PWA_API_URL } from "@/lib/apiConfig";

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
  const { userData, session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("not_requested");
  const [promptStatus, setPromptStatus] = useState<NotificationPromptStatus>("not_shown");
  const [oneSignal, setOneSignal] = useState<any>(null);
  const router = useRouter();

  const LS_PROMPT_STATUS_KEY = "socio_notification_prompt_status";

  // Load initial status
  useEffect(() => {
    const pStatus = localStorage.getItem(LS_PUSH_STATUS_KEY) as PushStatus;
    if (pStatus) setPushStatus(pStatus);

    const prStatus = localStorage.getItem(LS_PROMPT_STATUS_KEY) as NotificationPromptStatus;
    if (prStatus) setPromptStatus(prStatus);
  }, []);

  const updatePromptStatus = useCallback((status: NotificationPromptStatus) => {
    setPromptStatus(status);
    localStorage.setItem(LS_PROMPT_STATUS_KEY, status);
  }, []);

  const triggerPrompt = useCallback(() => {
    if (promptStatus === "accepted" || promptStatus === "denied") return;
    updatePromptStatus("shown");
  }, [promptStatus, updatePromptStatus]);

  // 1. OneSignal & Web Push Initialization (Passive)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (Capacitor.isNativePlatform()) {
      async function initOneSignal() {
        try {
          const OS = (await import("onesignal-cordova-plugin")).default;
          setOneSignal(OS);
          const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
          if (appId && appId !== "placeholder_onesignal_id_here") {
            OS.initialize(appId);
            OS.Notifications.addEventListener("click", (event: any) => {
              const route = event.notification.additionalData?.route;
              if (route) router.push(route);
            });
            OS.Notifications.addEventListener("foregroundWillDisplay", (event: any) => {
              event.preventDefault();
              const n = event.notification;
              toast.success(`${n.title}: ${n.body}`, {
                duration: 5000,
                position: "top-center",
              });
            });
          }
        } catch (e) {
          console.error("OS init error", e);
        }
      }
      initOneSignal();
    }
  }, [router]);

  // Sync User Tags (Native only)
  useEffect(() => {
    if (Capacitor.isNativePlatform() && oneSignal && userData?.email) {
      try {
        const externalId = userData.email.toLowerCase();
        oneSignal.login(externalId);
        oneSignal.User.addTags({
          department: userData.department || "none",
          campus: userData.campus || "none",
          email: externalId
        });
      } catch {}
    }
  }, [userData, oneSignal]);

  const enablePushNotifications = useCallback(async () => {
    if (typeof window === "undefined") return;

    // 1. Capacitor Native
    if (Capacitor.isNativePlatform()) {
      if (!oneSignal) return;
      try {
        const granted = await oneSignal.Notifications.requestPermission(true);
        const newStatus = granted ? "granted" : "denied";
        setPushStatus(newStatus);
        localStorage.setItem(LS_PUSH_STATUS_KEY, newStatus);
        updatePromptStatus(granted ? "accepted" : "denied");
        if (granted) toast.success("Notifications enabled!");
      } catch (e) {
        console.error("Native push error", e);
      }
      return;
    }

    // 2. Web Push (PWA)
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.warn("Web Push not supported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
        
        if (!vapidKey) {
          console.error("Missing VAPID key");
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        // Send to backend
        if (userData?.email) {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

          await fetch(`${PWA_API_URL}/notifications/push/subscribe`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              email: userData.email,
              subscription,
            }),
          });
        }

        setPushStatus("granted");
        localStorage.setItem(LS_PUSH_STATUS_KEY, "granted");
        updatePromptStatus("accepted");
        toast.success("Notifications enabled!");
      } else if (permission === "denied") {
        setPushStatus("denied");
        localStorage.setItem(LS_PUSH_STATUS_KEY, "denied");
        updatePromptStatus("denied");
      }
    } catch (e) {
      console.error("Web push error", e);
    }
  }, [oneSignal, userData?.email, session?.access_token, updatePromptStatus]);

  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // Fetch & Merge with Local States
  const fetchNotifications = useCallback(async (isLoadMore = false) => {
    if (!userData?.email) return;
    setIsLoading(true);
    const targetPage = isLoadMore ? page + 1 : 1;
    
    try {
      const res = await fetch(
        `${PWA_API_URL}/notifications?email=${encodeURIComponent(userData.email)}&page=${targetPage}&limit=15`,
        {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        }
      );
      if (res.ok) {
        const data = await res.json();
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
          setPage(targetPage);
        } else {
          setNotifications(processed);
          setPage(1);
        }

        setHasMore(raw.length === 15);
        setUnreadCount(isLoadMore ? unreadCount : processed.filter(n => !n.read).length);
      }
    } catch (err) {
      console.error("Fetch error", err);
    }
    setIsLoading(false);
  }, [userData?.email, session?.access_token, page, unreadCount]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchNotifications(true);
    }
  }, [isLoading, hasMore, fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    
    // Local persistence
    const set = getLocalSet(LS_READ_KEY);
    set.add(id);
    saveLocalSet(LS_READ_KEY, set);

    // Backend sync (best effort)
    if (userData?.email) {
      fetch(`${PWA_API_URL}/notifications/${id}/read`, {
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
      fetch(`${PWA_API_URL}/notifications/mark-read`, {
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
      fetch(`${PWA_API_URL}/notifications/${encodeURIComponent(id)}?email=${encodeURIComponent(userData.email)}`, {
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
      fetch(`${PWA_API_URL}/notifications?email=${encodeURIComponent(userData.email)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  }, [notifications, userData?.email]);

  return (
    <NotifContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        pushStatus,
        promptStatus,
        markRead,
        markAllRead,
        dismiss,
        dismissAll,
        refresh: fetchNotifications,
        hasMore,
        loadMore,
        enablePushNotifications,
        updatePromptStatus,
        triggerPrompt,
      }}
    >
      {children}
    </NotifContext.Provider>
  );
}
