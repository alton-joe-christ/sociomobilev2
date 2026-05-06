"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
// Removed top-level Capacitor imports to prevent SSR module resolution errors
import DesktopGate from "@/components/DesktopGate";
import OrientationGate from "@/components/OrientationGate";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";
import BrowserNotificationPrompt from "@/components/BrowserNotificationPrompt";
import ChatbotFab from "@/components/ChatbotFab";
import CampusSelector, { isCampusDismissedRecently } from "@/components/CampusSelector";
import PageTransition from "@/components/PageTransition";
import { useAuth } from "@/context/AuthContext";
import ShakeToScanListener from "@/components/ShakeToScanListener";

const NO_BOTTOM_NAV = ["/auth", "/auth/callback", "/offline"];
const NO_TOP_BAR = ["/auth/callback", "/offline", "/notifications"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hideBottom = NO_BOTTOM_NAV.some((p) => pathname.startsWith(p));
  const hideTop = NO_TOP_BAR.some((p) => pathname.startsWith(p));
  const { userData, session, needsCampus, refreshUserData } = useAuth();
  const [campusDismissed, setCampusDismissed] = useState(false);

  useEffect(() => {
    setCampusDismissed(isCampusDismissedRecently());
    
    const lockOrientation = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { ScreenOrientation } = await import("@capacitor/screen-orientation");
          await ScreenOrientation.lock({ orientation: "portrait" });
        }
      } catch (err) {
        console.warn("Capacitor orientation lock failed:", err);
      }
    };

    lockOrientation();

    // Deep Linking: Handle incoming URLs
    const setupDeepLinks = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");
        
        // Handle links when app is in background or already open
        await App.addListener('appUrlOpen', (data) => {
          const url = new URL(data.url);
          const path = url.pathname;
          
          if (path.startsWith('/event/')) {
            const eventId = path.split('/event/')[1];
            if (eventId) {
              router.push(`/event/${eventId}`);
            }
          }
        });

        // Handle cold start (app opened via link)
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl) {
          const url = new URL(launchUrl.url);
          const path = url.pathname;
          if (path.startsWith('/event/')) {
            const eventId = path.split('/event/')[1];
            if (eventId) {
              router.push(`/event/${eventId}`);
            }
          }
        }
      } catch (err) {
        console.warn("Deep link setup failed:", err);
      }
    };

    setupDeepLinks();
  }, [router]);

  const handleCampusComplete = (campus: string) => {
    if (campus) refreshUserData();
  };

  const handleCampusDismiss = () => {
    setCampusDismissed(true);
  };

  return (
    <>
      <DesktopGate />
      <OrientationGate />
      {!hideTop && <TopBar />}
      <main>
        <PageTransition>{children}</PageTransition>
      </main>
      {!hideBottom && <BottomNav />}
      {!hideBottom && <InstallPrompt />}
      {!hideBottom && <ChatbotFab />}
      {!hideBottom && userData && <BrowserNotificationPrompt />}
      <ShakeToScanListener />
      {needsCampus && !campusDismissed && userData && (
        <CampusSelector
          email={userData.email}
          accessToken={session?.access_token ?? ""}
          onComplete={handleCampusComplete}
          onDismiss={handleCampusDismiss}
        />
      )}
    </>
  );
}
