"use client";

/**
 * lib/onesignal.ts
 * ─────────────────────────────────────────────────────────────────
 * Safe, production-grade OneSignal Web Push initializer for SOCIO PWA.
 * ─────────────────────────────────────────────────────────────────
 */

import { Capacitor } from "@capacitor/core";

let initialized = false;

export function getOneSignalState(): "idle" | "initialized" {
  return initialized ? "initialized" : "idle";
}

export function _resetOneSignalState(): void {
  initialized = false;
}

/**
 * Manual targeted cleanup for debugging/diagnostics.
 * Wipes out service workers, caches, IndexedDB, and localStorage keys.
 * Only run manually in debug mode, never automatically on startup.
 */
export async function nukeServiceWorkers(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    console.log("[OneSignal Cleanup] Starting manual targeted cleanup...");
    
    // 1. Unregister active service workers
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.active && (reg.active.scriptURL.includes('onesignalsdkworker') || reg.scope.includes('push'))) {
          console.log("[OneSignal Cleanup] Unregistering bad/stale worker scope:", reg.scope);
          await reg.unregister();
        }
      }
    }

    // 2. Clear OneSignal caches
    const cacheKeys = await caches.keys();
    for (const key of cacheKeys) {
      if (key.toLowerCase().includes('onesignal')) {
        console.log("[OneSignal Cleanup] Deleting cache:", key);
        await caches.delete(key);
      }
    }

    // 3. Clear OneSignal IndexedDB databases
    if (window.indexedDB && (window.indexedDB as any).databases) {
      const dbs = await (window.indexedDB as any).databases();
      for (const db of dbs) {
        if (db.name && db.name.toLowerCase().includes('onesignal')) {
          console.log("[OneSignal Cleanup] Deleting IndexedDB:", db.name);
          window.indexedDB.deleteDatabase(db.name);
        }
      }
    }

    // 4. Delete local storage keys
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.toLowerCase().includes('onesignal')) {
        localStorage.removeItem(key);
      }
    }

    console.log("[OneSignal Cleanup] Manual targeted cleanup complete.");
  } catch (err) {
    console.warn("[OneSignal Cleanup] Manual cleanup failed:", err);
  }
}

export function initOneSignal(): void {
  // ── Guard 1: SSR check ─────────────────────────────────────────
  if (typeof window === "undefined") return;

  // ── STEP 7: Guard duplicate initialization ────────────────────
  if (initialized) {
    console.log("[OneSignal] Already initialized");
    return;
  }
  initialized = true;

  // Actual initialization routine
  const runInit = async () => {
    // ── STEP 5: Browser capability checks ────────────────────────
    if (!("serviceWorker" in navigator)) {
      console.log("[OneSignal] Skipping init: Service Workers not supported");
      initialized = false;
      return;
    }
    if (!("Notification" in window)) {
      console.log("[OneSignal] Skipping init: Notifications not supported");
      initialized = false;
      return;
    }
    if (!window.isSecureContext) {
      console.log("[OneSignal] Skipping init: Page not in a secure context");
      initialized = false;
      return;
    }

    // Capacitor platform check
    if (Capacitor.isNativePlatform()) {
      console.log("[OneSignal] Native platform detected — skipping web push init");
      return;
    }

    // App ID Check
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId || appId === "placeholder_onesignal_id_here") {
      console.warn("[OneSignal] Missing app ID — skipping init");
      initialized = false;
      return;
    }

    // ── STEP 6: Add explicit permission diagnostics ──────────────
    console.log("[OneSignal] Running pre-init diagnostics:");
    console.log("  • Notification.permission:", Notification.permission);
    console.log("  • navigator.serviceWorker:", !!navigator.serviceWorker);
    console.log("  • navigator.userAgent:", navigator.userAgent);
    console.log("  • window.location.origin:", window.location.origin);

    console.log("[OneSignal] Initializing...");

    // ── STEP 1: Wrap init in try/catch with detailed logs ────────
    try {
      const OneSignal = (await import("react-onesignal")).default;

      // ── STEP 2: Add soft timeout protection ────────────────────
      const initPromise = OneSignal.init({
        appId: appId,
        serviceWorkerPath: "/push/OneSignalSDKWorker.js",
        serviceWorkerUpdaterPath: "/push/OneSignalSDKUpdaterWorker.js",
        serviceWorkerParam: {
          scope: "/push/",
        },
        notifyButton: {
          enable: false,
        } as any,
      });

      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.warn("[OneSignal] Init taking longer than expected...");
          resolve("timeout");
        }, 10000);
      });

      // Race initialization against the timeout limit without throwing
      await Promise.race([initPromise, timeoutPromise]);

      // Continue waiting silently in background for full initialization
      initPromise
        .then(() => {
          console.log("[OneSignal] SDK fully initialized");

          // click listener
          try {
            if (OneSignal.Notifications) {
              OneSignal.Notifications.addEventListener("click", (event: any) => {
                console.log("[OneSignal] Notification clicked:", event);
                const n = event.notification;
                window.dispatchEvent(
                  new CustomEvent("socio:notificationClick", {
                    detail: {
                      route: n.additionalData?.route,
                      actionUrl: n.additionalData?.actionUrl,
                      eventId: n.additionalData?.eventId,
                      festId: n.additionalData?.festId
                    }
                  })
                );
              });
              console.log("[OneSignal] click listener attached successfully");
            }
          } catch (clickErr) {
            console.warn("[OneSignal] Failed to attach click listener:", clickErr);
          }

          // foregroundWillDisplay listener
          try {
            if (OneSignal.Notifications) {
              OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event: any) => {
                console.log("[OneSignal] Foreground notification arrived:", event);
                event.preventDefault();
                const n = event.notification;
                const payloadType = n.additionalData?.type || "event";
                const payloadBadge = n.additionalData?.badge || "UPDATE";
                const payloadCtaText = n.additionalData?.ctaText || "View Event";
                const payloadCtaRoute = n.additionalData?.route || n.additionalData?.actionUrl || "/notifications";
                window.dispatchEvent(
                  new CustomEvent("socio:foregroundNotification", {
                    detail: {
                      title: n.title,
                      body: n.body,
                      type: payloadType,
                      badge: payloadBadge,
                      ctaText: payloadCtaText,
                      ctaRoute: payloadCtaRoute,
                      icon: n.icon
                    }
                  })
                );
              });
              console.log("[OneSignal] foregroundWillDisplay listener attached successfully");
            }
          } catch (fgErr) {
            console.warn("[OneSignal] Failed to attach foreground listener:", fgErr);
          }

          // permissionChange listener
          try {
            if (OneSignal.Notifications) {
              OneSignal.Notifications.addEventListener("permissionChange", (permission: boolean) => {
                console.log("[OneSignal] Permission changed:", permission);
              });
              console.log("[OneSignal] permissionChange listener attached successfully");
            }
          } catch (permErr) {
            console.warn("[OneSignal] Failed to attach permission listener:", permErr);
          }

          // subscription change listener
          try {
            if (OneSignal.User && OneSignal.User.PushSubscription) {
              OneSignal.User.PushSubscription.addEventListener("change", (event: any) => {
                console.log("[OneSignal] Push subscription changed:", event);
              });
              console.log("[OneSignal] Push subscription listener attached successfully");
            }
          } catch (subErr) {
            console.warn("[OneSignal] Failed to attach subscription listener:", subErr);
          }

          // ── STEP 10: Verify subscription state ──────────────────────
          try {
            if (OneSignal?.User?.PushSubscription) {
              console.log(
                "[OneSignal] optedIn:",
                OneSignal.User.PushSubscription.optedIn
              );
              console.log("[OneSignal] pushToken:", OneSignal.User.PushSubscription.token || "none");
              console.log("[OneSignal] id:", OneSignal.User.PushSubscription.id || "none");
            }
          } catch (stateErr) {
            console.warn("[OneSignal] Failed to verify subscription state:", stateErr);
          }

          console.log("[OneSignal] Init success");
        })
        .catch((err) => {
          console.error("[OneSignal] Background init failed:", err);
        });

    } catch (err: any) {
      initialized = false; // Reset state so a retry can be attempted later
      console.error("[OneSignal] Initialization error:", err.message || err);
    }
  };

  // ── STEP 4: Delay OneSignal initialization ────────────────────
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      runInit();
    });
  } else {
    setTimeout(runInit, 2000);
  }
}
