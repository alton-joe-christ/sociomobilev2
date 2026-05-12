"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
// Capacitor imports are deferred via dynamic import inside useEffect to prevent SSR errors
import DesktopGate from "@/components/DesktopGate";
import OrientationGate from "@/components/OrientationGate";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";
import PageTransition from "@/components/PageTransition";
import NativeLaunchController from "@/components/native/NativeLaunchController";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import { isCampusDismissedRecently } from "@/components/CampusSelector";
import { logCapacitorPerfAudit, logMemorySnapshot, startFrameMonitor, startPerfSpan, withPerfSpan } from "@/lib/capacitorPerfAudit";

// Lazy load heavy/secondary components
const ChatbotFab = dynamic(() => import("@/components/ChatbotFab"), { ssr: false });
const SmartNotificationPrompt = dynamic(() => import("@/components/SmartNotificationPrompt"), { ssr: false });
const CampusSelector = dynamic(() => import("@/components/CampusSelector"), { ssr: false });
const ShakeToScanListener = dynamic(() => import("@/components/ShakeToScanListener"), { ssr: false });

const NO_BOTTOM_NAV = ["/auth", "/auth/callback", "/offline"];
const NO_TOP_BAR = ["/auth/callback", "/offline", "/notifications"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hideBottom = NO_BOTTOM_NAV.some((p) => pathname.startsWith(p));
  const hideTop = NO_TOP_BAR.some((p) => pathname.startsWith(p));
  const { userData, needsCampus, refreshUserData } = useAuth();
  const [campusDismissed, setCampusDismissed] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const previousPathRef = useRef<string>(pathname);
  const stopFrameMonitorRef = useRef<(() => void) | null>(null);


  useEffect(() => {
    // Check if dismissed recently — isCampusDismissedRecently is a pure
    // localStorage helper guarded internally with typeof window checks.
    setCampusDismissed(isCampusDismissedRecently());
  }, []);

  useEffect(() => {
    void withPerfSpan("appshell.detect-platform", async () => {
      const { Capacitor } = await import("@capacitor/core");
      const nativePlatform = Capacitor.isNativePlatform();
      setIsNative(nativePlatform);
      logCapacitorPerfAudit("appshell.platform", { nativePlatform, platform: Capacitor.getPlatform() });
    });
  }, []);

  useEffect(() => {
    let deepLinkListener: { remove: () => Promise<void> } | null = null;

    const lockOrientation = async () => {
      try {
        await withPerfSpan("appshell.lock-orientation", async () => {
          const { Capacitor } = await import("@capacitor/core");
          if (Capacitor.isNativePlatform()) {
            const { ScreenOrientation } = await import("@capacitor/screen-orientation");
            await ScreenOrientation.lock({ orientation: "portrait" });
          }
        });
      } catch (err) {
        console.warn("Capacitor orientation lock failed:", err);
      }
    };

    const setupDeepLinks = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");
        
        // Handle links when app is in background or already open
        deepLinkListener = await App.addListener('appUrlOpen', (data) => {
          console.log("👉 [AppShell] Deep Link Hit:", data.url);
          try {
            const url = new URL(data.url);
            
            // 🛑 [AuthRaceFix] If this is an auth callback with tokens, do NOT navigate.
            // Let AuthContext handle the session exchange.
            const isAuthCallback = url.pathname.includes('/auth/callback') || 
                                   url.hash.includes('access_token=') || 
                                   url.searchParams.has('access_token') ||
                                   url.searchParams.has('code');
            
            if (isAuthCallback) {
              console.log("🛑 [AppShell] Auth callback detected. Suppressing navigation to let AuthContext handle it.");
              return;
            }

            const path = url.pathname + url.search;
            if (path && path !== '/') {
              console.log("🚀 [AppShell] Navigating to:", path);
              router.push(path);
            }
          } catch (e) {
            console.warn("[AppShell] Invalid deep link URL:", data.url);
          }
        });
      } catch (err) {
        console.warn("Deep link setup failed:", err);
      }
    };

    lockOrientation();
    setupDeepLinks();

    return () => {
      if (deepLinkListener) {
        deepLinkListener.remove().catch(() => {});
      }
    };

  }, [router]);

  useEffect(() => {
    const prev = previousPathRef.current;
    if (prev === pathname) return;

    const end = startPerfSpan("appshell.route-transition", { from: prev, to: pathname });
    stopFrameMonitorRef.current?.();
    stopFrameMonitorRef.current = startFrameMonitor(`route:${prev}->${pathname}`, 1000);
    previousPathRef.current = pathname;

    const timer = setTimeout(() => {
      end({ phase: "settled" });
      logMemorySnapshot(`route:${pathname}`);
    }, 320);

    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const end = startPerfSpan("appshell.mount");
    const timer = setTimeout(() => end({ phase: "initial-render" }), 0);
    return () => {
      clearTimeout(timer);
      stopFrameMonitorRef.current?.();
      stopFrameMonitorRef.current = null;
    };
  }, []);

  const handleCampusComplete = (campus: string) => {
    if (campus) refreshUserData();
  };

  const handleCampusDismiss = () => {
    setCampusDismissed(true);
  };

  return (
    <>
      <NativeLaunchController />
      <OrientationGate />
      {!isNative && <DesktopGate />}
      {!hideTop && <TopBar />}
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-dvh flex flex-col">
        <PageTransition>{children}</PageTransition>
      </main>
      {!hideBottom && <BottomNav />}
      {!hideBottom && !isNative && <InstallPrompt />}
      {!hideBottom && <ChatbotFab />}
      {!hideBottom && userData && <SmartNotificationPrompt />}
      {/* <ShakeToScanListener /> */}

      {needsCampus && !campusDismissed && userData && (
        <CampusSelector
          email={userData.email}
          onComplete={handleCampusComplete}
          onDismiss={handleCampusDismiss}
        />
      )}
    </>
  );
}
