"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
// Removed top-level Capacitor imports to prevent SSR module resolution errors
import DesktopGate from "@/components/DesktopGate";
import OrientationGate from "@/components/OrientationGate";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";
import SmartNotificationPrompt from "@/components/SmartNotificationPrompt";
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
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => {
      setIsNative(Capacitor.isNativePlatform());
    });
  }, []);

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

    // lockOrientation();
    // setupDeepLinks();
  }, [router]);

  const handleCampusComplete = (campus: string) => {
    if (campus) refreshUserData();
  };

  const handleCampusDismiss = () => {
    setCampusDismissed(true);
  };

  return (
    <>
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
          accessToken={session?.access_token ?? ""}
          onComplete={handleCampusComplete}
          onDismiss={handleCampusDismiss}
        />
      )}
    </>
  );
}
