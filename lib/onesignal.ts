"use client";

/**
 * lib/onesignal.ts
 * ─────────────────────────────────────────────────────────────────
 * Safe OneSignal Web Push initializer for SOCIO PWA.
 *
 * State machine:
 *   idle → initializing → initialized
 *                       ↘ failed
 *
 * Guards:
 *  • SSR            — never runs on the server
 *  • Capacitor APK  — web push skipped; future native FCM handles it
 *  • Duplicate init — state machine prevents concurrent / repeated calls
 *  • StrictMode     — module-level state survives React's double-invoke
 *  • Unsupported    — graceful no-op when Notification API is absent
 *  • Missing appId  — explicit log instead of crash
 * ─────────────────────────────────────────────────────────────────
 */

import { Capacitor } from "@capacitor/core";

type InitState = "idle" | "initializing" | "initialized" | "failed";

let state: InitState = "idle";

/** Returns the current init state — useful for diagnostics/testing. */
export function getOneSignalState(): InitState {
  return state;
}

export async function nukeServiceWorkers(): Promise<void> {
  if (typeof window === "undefined") return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    console.log("[SW] Unregistering:", reg.scope);
    await reg.unregister();
  }

  const cacheKeys = await caches.keys();
  for (const key of cacheKeys) {
    console.log("[SW] Deleting cache:", key);
    await caches.delete(key);
  }

  if (window.indexedDB && (window.indexedDB as any).databases) {
    try {
      const dbs = await (window.indexedDB as any).databases();
      for (const db of dbs) {
        if (db.name) {
          console.log("[SW] Deleting DB:", db.name);
          window.indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (dbErr) {
      console.warn("[SW] DB lookup failed:", dbErr);
    }
  }

  localStorage.clear();
  sessionStorage.clear();

  console.log("[SW] Full cleanup complete");
}

export async function initOneSignal(): Promise<void> {
  // ── Guard 1: SSR ───────────────────────────────────────────────
  if (typeof window === "undefined") return;

  // ── Guard 2: State machine — prevent concurrent / duplicate calls
  if (state === "initialized") {
    console.log("[OneSignal] Already initialized");
    return;
  }
  if (state === "initializing") {
    console.log("[OneSignal] Init already in progress — skipping duplicate call");
    return;
  }
  if (state === "failed") {
    // Allow a single retry on explicit user action; do NOT retry on every
    // route transition.  Callers that want a retry must call _resetOneSignalState().
    console.log("[OneSignal] Previous init failed — call _resetOneSignalState() to retry");
    return;
  }

  // ── Guard 3: Capacitor native APK ─────────────────────────────
  if (Capacitor.isNativePlatform()) {
    console.log("[OneSignal] Native platform detected — skipping web push init");
    return;
  }

  // ── Guard 4: Browser Notification API ─────────────────────────
  if (!("Notification" in window)) {
    console.log("[OneSignal] Notifications unsupported in this browser");
    return;
  }

  // ── Guard 5: App ID ───────────────────────────────────────────
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId || appId === "placeholder_onesignal_id_here") {
    console.warn("[OneSignal] Missing app ID — skipping init");
    return;
  }

  // ── Reset: Programmatically destroy all stale Service Workers, Caches, DBs, and Storage ──
  try {
    if (typeof window !== "undefined") {
      await nukeServiceWorkers();
      console.log("[OneSignal] Cleaned all stale browser states and databases.");
      // 5. Wait before init
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  } catch (resetErr) {
    console.warn("[OneSignal] Stale cache cleanup failed:", resetErr);
  }

  // ── Transition: idle → initializing ───────────────────────────
  state = "initializing";
  console.log("[OneSignal] Initializing...");

  try {
    if (typeof window !== "undefined") {
      (window as any).OneSignal = (window as any).OneSignal || [];
      (window as any).OneSignal.SERVICE_WORKER_PATH = 'push/OneSignalSDKWorker.js';
      (window as any).OneSignal.SERVICE_WORKER_UPDATER_PATH = 'push/OneSignalSDKUpdaterWorker.js';
      (window as any).OneSignal.SERVICE_WORKER_PARAM = { scope: '/push/' };
    }

    const OneSignal = (await import("react-onesignal")).default;

    console.log("[OneSignal] Current origin:", window.location.origin);
    console.log("[OneSignal] Worker path:", "push/OneSignalSDKWorker.js");
    console.log("[OneSignal] Updater path:", "push/OneSignalSDKUpdaterWorker.js");

    await OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: "push/OneSignalSDKWorker.js",
      serviceWorkerUpdaterPath: "push/OneSignalSDKUpdaterWorker.js",
      notifyButton: { enable: false } as any,
    });

    // ── Transition: initializing → initialized ─────────────────
    state = "initialized";
    console.log("[OneSignal] Initialized successfully");

    // ── Delivery pipeline diagnostics ─────────────────────────
    // token = raw FCM/WebPush token — null means NOT fully subscribed
    try {
      const permission = OneSignal.Notifications.permission;
      const optedIn    = OneSignal.User.PushSubscription.optedIn;
      const subId      = OneSignal.User.PushSubscription.id;
      const token      = (OneSignal.User.PushSubscription as any).token;

      console.log("[OneSignal] Permission:", permission);
      console.log("[OneSignal] Subscribed (optedIn):", optedIn);
      console.log("[OneSignal] Subscription ID:", subId  || "⚠ null — not registered in dashboard yet");
      console.log("[OneSignal] Push token:      ", token  || "⚠ null — device is NOT fully subscribed");

      // If permission is granted but device is not opted in, force opt-in.
      // This handles the edge case where the SDK initialised but never
      // called optIn() — common after a storage clear or first install.
      if (permission === true && !optedIn) {
        console.log("[OneSignal] Permission granted but not opted in — forcing optIn()");
        await (OneSignal.User.PushSubscription as any).optIn?.();
      }
    } catch (diagErr) {
      console.warn("[OneSignal] Subscription diagnostics failed:", diagErr);
    }

    // ── Foreground notification display ────────────────────────
    // Chrome suppresses push notifications while the tab is in focus.
    // preventDefault() MUST be called first — it stops OneSignal's own
    // auto-handling, then display() re-shows the notification manually.
    try {
      OneSignal.Notifications.addEventListener(
        "foregroundWillDisplay",
        (event: any) => {
          console.log("[OneSignal] Foreground notification received:", event?.notification?.title);
          event?.preventDefault?.();          // ← must come before display()
          event?.notification?.display?.();   // ← force show even while page is open
        }
      );
    } catch (fgErr) {
      console.warn("[OneSignal] Foreground listener setup failed:", fgErr);
    }

    // ── Subscription change listener ───────────────────────────
    try {
      OneSignal.User.PushSubscription.addEventListener(
        "change",
        (event: any) => {
          const current = event?.current;
          console.log("[OneSignal] Subscription changed → optedIn:", current?.optedIn, "| id:", current?.id);
        }
      );
    } catch (subErr) {
      console.warn("[OneSignal] Subscription change listener failed:", subErr);
    }

    // ── Push receive listener (SW fires this) ──────────────────
    try {
      OneSignal.Notifications.addEventListener(
        "click",
        (event: any) => {
          console.log("[OneSignal] Notification clicked:", event?.notification?.title);
        }
      );
    } catch (clickErr) {
      console.warn("[OneSignal] Click listener setup failed:", clickErr);
    }
  } catch (err: unknown) {
    // ── Transition: initializing → failed ─────────────────────
    state = "failed";

    // Structured telemetry — no sensitive payloads exposed
    if (err instanceof Error) {
      const msg = err.message ?? "";

      if (msg.includes("permission") || msg.toLowerCase().includes("denied")) {
        console.warn("[OneSignal] Permission denied:", msg);
      } else if (
        msg.includes("serviceWorker") ||
        msg.includes("service worker") ||
        msg.includes("registration")
      ) {
        console.error("[OneSignal] Service worker registration failure:", msg);
      } else if (msg.includes("subscription")) {
        console.error("[OneSignal] Subscription failure:", msg);
      } else {
        console.error("[OneSignal] Init failed:", msg);
      }
    } else {
      console.error("[OneSignal] Init failed with unknown error");
    }
  }
}

/**
 * Reset the state machine back to idle.
 *
 * Intended for:
 *  • Unit tests
 *  • Explicit user-triggered retry after a "failed" state
 *
 * Do NOT call this on every route transition.
 */
export function _resetOneSignalState(): void {
  state = "idle";
}
