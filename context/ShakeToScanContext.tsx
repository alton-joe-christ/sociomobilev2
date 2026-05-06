"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Motion } from "@capacitor/motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useAuth } from "@/context/AuthContext";
import { getActiveVolunteerEvents } from "@/lib/volunteerAccess";
import toast from "react-hot-toast";

interface ShakeToScanState {
  activeScanEvent: string | null;
  shakeEnabled: boolean;
}

type MotionPermission = "unknown" | "granted" | "denied";

interface ShakeToScanContextValue extends ShakeToScanState {
  motionSupported: boolean;
  motionPermission: MotionPermission;
  enableForEvent: (eventId: string) => void;
  disableShake: () => void;
  requestMotionPermission: () => Promise<boolean>;
}

const STORAGE_KEY = "socio_shake_to_scan";
const DEFAULT_STATE: ShakeToScanState = { activeScanEvent: null, shakeEnabled: false };
const SHAKE_THRESHOLD = 25; // Sensitivity threshold
const COOLDOWN_MS = 2500; // 2.5 seconds cooldown between triggers

function readStoredState(): ShakeToScanState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<ShakeToScanState>;
    const activeScanEvent = typeof parsed.activeScanEvent === "string" ? parsed.activeScanEvent : null;
    const shakeEnabled = Boolean(parsed.shakeEnabled && activeScanEvent);
    return { activeScanEvent, shakeEnabled };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_STATE;
  }
}

function writeStoredState(state: ShakeToScanState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const ShakeToScanContext = createContext<ShakeToScanContextValue>({
  ...DEFAULT_STATE,
  motionSupported: false,
  motionPermission: "unknown",
  enableForEvent: () => {},
  disableShake: () => {},
  requestMotionPermission: async () => false,
});

export function useShakeToScan() {
  const context = useContext(ShakeToScanContext);
  if (!context) {
    throw new Error("useShakeToScan must be used within a ShakeToScanProvider");
  }
  return context;
}

export function ShakeToScanProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { userData, session } = useAuth();
  const [state, setState] = useState<ShakeToScanState>(DEFAULT_STATE);
  const [motionPermission, setMotionPermission] = useState<MotionPermission>("unknown");
  const lastTriggerRef = useRef<number>(0);

  const motionSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return "DeviceMotionEvent" in window;
  }, []);

  // Access Control: Check if user is a volunteer with active events
  const isAuthorizedVolunteer = useMemo(() => {
    if (!userData || !session) return false;
    const activeEvents = getActiveVolunteerEvents(userData.volunteerEvents);
    return activeEvents.length > 0;
  }, [userData, session]);

  useEffect(() => {
    const stored = readStoredState();
    // Validate that the stored event is still active for this user
    if (stored.shakeEnabled && stored.activeScanEvent && userData?.volunteerEvents) {
      const isActive = getActiveVolunteerEvents(userData.volunteerEvents).some(
        e => e.event_id === stored.activeScanEvent
      );
      if (!isActive) {
        setState(DEFAULT_STATE);
        writeStoredState(DEFAULT_STATE);
        return;
      }
    }
    setState(stored);
  }, [userData?.volunteerEvents]);

  useEffect(() => {
    if (!motionSupported || typeof window === "undefined") {
      setMotionPermission("denied");
      return;
    }

    // Capacitor Motion handles permissions differently on iOS/Android
    // For iOS, we might still need to call requestPermission
  }, [motionSupported]);

  const updateState = useCallback((next: ShakeToScanState) => {
    setState(next);
    writeStoredState(next);
  }, []);

  const enableForEvent = useCallback(
    (eventId: string) => {
      if (!eventId) return;
      updateState({ activeScanEvent: eventId, shakeEnabled: true });
      toast.success("Shake to Scan enabled");
    },
    [updateState]
  );

  const disableShake = useCallback(() => {
    updateState(DEFAULT_STATE);
    toast.dismiss("shake-active");
  }, [updateState]);

  const requestMotionPermission = useCallback(async () => {
    if (typeof window === "undefined") return false;
    if (!motionSupported) return false;

    // Capacitor Motion automatically handles native permissions on most platforms
    // but we can try to trigger the iOS dialog if available
    const dmEvent = (window as any).DeviceMotionEvent;
    if (dmEvent && typeof dmEvent.requestPermission === "function") {
      try {
        const result = await dmEvent.requestPermission();
        setMotionPermission(result === "granted" ? "granted" : "denied");
        return result === "granted";
      } catch (e) {
        console.error("ShakeToScan: Permission request failed", e);
        return false;
      }
    }

    setMotionPermission("granted");
    return true;
  }, [motionSupported]);

  // Motion Detection Listener
  useEffect(() => {
    if (!state.shakeEnabled || !state.activeScanEvent || !isAuthorizedVolunteer) return;

    let listener: any = null;

    const startListening = async () => {
      try {
        listener = await Motion.addListener("accel", (event) => {
          const { x, y, z } = event.acceleration;
          const totalAccel = Math.sqrt(x * x + y * y + z * z);

          if (totalAccel > SHAKE_THRESHOLD) {
            const now = Date.now();
            if (now - lastTriggerRef.current > COOLDOWN_MS) {
              lastTriggerRef.current = now;
              handleShakeTrigger();
            }
          }
        });
      } catch (err) {
        console.error("ShakeToScan: Failed to add motion listener", err);
      }
    };

    const handleShakeTrigger = async () => {
      // Don't trigger if already on the scanner page for this event
      const targetUrl = `/volunteer/scanner/${state.activeScanEvent}`;
      if (pathname === targetUrl) return;

      // UX Feedback
      await Haptics.impact({ style: ImpactStyle.Heavy });
      
      const eventTitle = userData?.volunteerEvents?.find(e => e.event_id === state.activeScanEvent)?.title || "Event";
      toast(`Opening scanner for ${eventTitle}`, {
        icon: "📳",
        duration: 2000,
        position: "top-center"
      });

      // Navigation
      router.push(targetUrl);
    };

    void startListening();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [state.shakeEnabled, state.activeScanEvent, isAuthorizedVolunteer, router, pathname, userData?.volunteerEvents]);

  return (
    <ShakeToScanContext.Provider
      value={{
        activeScanEvent: state.activeScanEvent,
        shakeEnabled: state.shakeEnabled,
        motionSupported,
        motionPermission,
        enableForEvent,
        disableShake,
        requestMotionPermission,
      }}
    >
      {children}
    </ShakeToScanContext.Provider>
  );
}


