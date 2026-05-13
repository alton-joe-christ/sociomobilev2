"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/context/EventContext";
import {
  isAndroidNativeBuild,
  isReducedSensoryMode,
  markNativeOnboardingCompleted,
  NATIVE_TRANSITION_EVENT_NAMES,
  shouldShowNativeOnboarding,
  stopRecoveryTransition,
  touchNativeLaunchStorage,
  type RecoveryReason,
} from "@/lib/nativeLaunchState";
import { FirstLaunchPanel, OperationalPanel, RecoveryCard } from "@/components/loading";
import type { OperationKey } from "@/components/loading";
import { logCapacitorPerfAudit, startFrameMonitor, startPerfSpan } from "@/lib/capacitorPerfAudit";

type TransitionMode = "pending" | "none" | "micro-splash" | "full-intro" | "account-transition" | "micro-recovery";

interface StartupSteps {
  authReady: boolean;
  scannerReady: boolean;
  eventsReady: boolean;
  storageReady: boolean;
}

interface AuthTransitionDetail {
  event?: string;
  message?: string;
}

interface RecoveryTransitionDetail {
  reason?: RecoveryReason;
  message?: string;
}

const RECOVERY_THRESHOLD_MS = 700;
const ACCOUNT_TRANSITION_MS_NATIVE = 580;
const ACCOUNT_TRANSITION_MS_WEB = 460;
const RECOVERY_MIN_VISIBLE_MS = 340;
const RECOVERY_COOLDOWN_MS = 2500;
const ACCOUNT_COOLDOWN_MS = 1400;
const FULL_INTRO_MAX_MS = 8000;
const SPLASH_MS_NATIVE = 160;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function prepareScannerSubsystem() {
  if (!isAndroidNativeBuild()) return;
  try {
    const mod = await import("@capacitor-mlkit/barcode-scanning");
    await mod.BarcodeScanner.checkPermissions();
  } catch (error) {
    console.warn("[NativeTransition] Scanner warmup skipped:", error);
  }
}

async function triggerSubtleHaptic() {
  if (!isAndroidNativeBuild() || isReducedSensoryMode()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    console.warn("[NativeTransition] Haptic skipped:", error);
  }
}

function messageForAuthEvent(event?: string) {
  if (event === "SIGNED_OUT") return "Switching profiles";
  if (event === "SIGNED_IN") return "Restoring profile";
  return "Refreshing session";
}

function recoveryToOperation(reason: RecoveryReason): OperationKey {
  switch (reason) {
    case "auth":
    case "session-refresh":
      return "auth.restore";
    case "events":
      return "events.sync";
    case "scanner-verify":
      return "scanner.verify";
    case "network-reconnect":
    case "route-recovery":
      return "offline.recover";
    case "cache-restore":
      return "cache.restore";
    default:
      return "offline.recover";
  }
}

export default function NativeLaunchController() {
  const pathname = usePathname();
  const { session, isLoading: authLoading } = useAuth();
  const { isLoading: eventsLoading, allEvents } = useEvents();
  const [mode, setMode] = useState<TransitionMode>("pending");
  const [recoveryOp, setRecoveryOp] = useState<OperationKey>("offline.recover");
  const [recoveryMessage, setRecoveryMessage] = useState("Reconnecting");
  const [accountMessage, setAccountMessage] = useState("Switching profiles");
  const [closing, setClosing] = useState(false);
  const [steps, setSteps] = useState<StartupSteps>({
    authReady: false,
    scannerReady: false,
    eventsReady: false,
    storageReady: false,
  });

  const isNativeAndroid = isAndroidNativeBuild();
  const isScannerRoute = pathname.startsWith("/volunteer/scanner/");
  const reducedSensory = isReducedSensoryMode();
  const activeRecoveryReasonsRef = useRef(new Set<RecoveryReason>());
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryVisibleSinceRef = useRef<number>(0);
  const pendingAuthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEventsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecoveryShownRef = useRef<number>(0);
  const lastAccountShownRef = useRef<number>(0);
  const finalizedRef = useRef(false);
  const firstStableAuthRef = useRef(false);
  const prevSessionIdRef = useRef<string | null>(null);
  const modeRef = useRef<TransitionMode>("pending");

  const progress = useMemo(() => {
    const done = Number(steps.authReady) + Number(steps.scannerReady) + Number(steps.eventsReady) + Number(steps.storageReady);
    return (done / 4) * 100;
  }, [steps]);

  const launchStageIndex = useMemo(() => {
    if (!steps.authReady) return 0;
    if (!steps.scannerReady) return 1;
    if (!steps.eventsReady) return 2;
    if (!steps.storageReady) return 3;
    return 4;
  }, [steps]);

  const clearTransitionFlags = () => {
    setClosing(false);
  };

  const closeActiveTransition = (next: TransitionMode = "none") => {
    setClosing(true);
    setTimeout(() => {
      clearTransitionFlags();
      setMode(next);
    }, 220);
  };

  const maybeShowMicroRecovery = (nextMessage: string, reason: RecoveryReason) => {
    const now = Date.now();
    if (modeRef.current === "full-intro" || modeRef.current === "account-transition") return;
    if (now - lastRecoveryShownRef.current < RECOVERY_COOLDOWN_MS) return;

    activeRecoveryReasonsRef.current.add(reason);
    lastRecoveryShownRef.current = now;
    recoveryVisibleSinceRef.current = now;
    setRecoveryOp(recoveryToOperation(reason));
    setRecoveryMessage(nextMessage);
    setMode("micro-recovery");
    logCapacitorPerfAudit("transition.micro-recovery.show", { reason, nextMessage });
  };

  const stopMicroRecoveryReason = (reason: RecoveryReason) => {
    activeRecoveryReasonsRef.current.delete(reason);
    if (activeRecoveryReasonsRef.current.size > 0) return;
    if (modeRef.current !== "micro-recovery") return;

    const elapsed = Date.now() - recoveryVisibleSinceRef.current;
    const remaining = Math.max(0, RECOVERY_MIN_VISIBLE_MS - elapsed);
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = setTimeout(() => closeActiveTransition("none"), remaining);
  };

  const triggerAccountTransition = (nextMessage: string) => {
    const now = Date.now();
    if (modeRef.current === "full-intro") return;
    if (now - lastAccountShownRef.current < ACCOUNT_COOLDOWN_MS) return;
    lastAccountShownRef.current = now;

    setAccountMessage(nextMessage);
    setMode("account-transition");
    logCapacitorPerfAudit("transition.account.show", { nextMessage, native: isNativeAndroid });

    const duration = isNativeAndroid ? ACCOUNT_TRANSITION_MS_NATIVE : ACCOUNT_TRANSITION_MS_WEB;
    setTimeout(() => closeActiveTransition("none"), duration);
  };

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const stopFrameMonitor = startFrameMonitor("native-transition.initial", 900);
    if (shouldShowNativeOnboarding()) {
      setMode("full-intro");
      logCapacitorPerfAudit("transition.full-intro.eligible");
      return () => stopFrameMonitor();
    }

    if (isNativeAndroid) {
      setMode("micro-splash");
      const splashTimer = setTimeout(() => setMode("none"), SPLASH_MS_NATIVE);
      return () => {
        clearTimeout(splashTimer);
        stopFrameMonitor();
      };
    }

    setMode("none");
    return () => stopFrameMonitor();
  }, [isNativeAndroid]);

  useEffect(() => {
    if (mode !== "full-intro") return;
    const endIntroSpan = startPerfSpan("transition.full-intro.runtime");
    return () => {
      endIntroSpan({ status: "disposed" });
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "full-intro") return;
    let cancelled = false;

    const fallbackTimer = setTimeout(() => {
      if (cancelled) return;
      logCapacitorPerfAudit("transition.full-intro.failsafe-close");
      markNativeOnboardingCompleted();
      closeActiveTransition("none");
    }, FULL_INTRO_MAX_MS);

    (async () => {
      try {
        touchNativeLaunchStorage();
      } finally {
        if (!cancelled) {
          setSteps((prev) => ({ ...prev, storageReady: true }));
        }
      }
    })();

    (async () => {
      try {
        await prepareScannerSubsystem();
      } finally {
        if (!cancelled) {
          setSteps((prev) => ({ ...prev, scannerReady: true }));
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "full-intro") return;
    if (!authLoading) setSteps((prev) => ({ ...prev, authReady: true }));
  }, [mode, authLoading]);

  useEffect(() => {
    if (mode !== "full-intro") return;
    if (!eventsLoading || allEvents.length > 0) {
      setSteps((prev) => ({ ...prev, eventsReady: true }));
    }
  }, [mode, eventsLoading, allEvents.length]);

  useEffect(() => {
    if (mode !== "full-intro") return;
    if (finalizedRef.current) return;
    if (!(steps.authReady && steps.scannerReady && steps.eventsReady && steps.storageReady)) return;

    finalizedRef.current = true;
    let cancelled = false;

    (async () => {
      await triggerSubtleHaptic();
      if (cancelled) return;

      await sleep(220);
      if (cancelled) return;

      markNativeOnboardingCompleted();
      closeActiveTransition("none");
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, reducedSensory, steps]);

  useEffect(() => {
    if (mode === "full-intro") return;
    const currentSessionId = session?.user?.id ?? null;

    if (!firstStableAuthRef.current) {
      if (!authLoading) {
        firstStableAuthRef.current = true;
        prevSessionIdRef.current = currentSessionId;
      }
      return;
    }

    if (prevSessionIdRef.current !== currentSessionId) {
      triggerAccountTransition("Switching profiles");
      prevSessionIdRef.current = currentSessionId;
    }
  }, [authLoading, mode, session?.user?.id]);

  useEffect(() => {
    if (mode === "full-intro") return;
    const onAuthTransition = (ev: Event) => {
      const detail = (ev as CustomEvent<AuthTransitionDetail>).detail || {};
      const authEvent = detail.event;
      triggerAccountTransition(detail.message || messageForAuthEvent(authEvent));
    };

    const onRecoveryStart = (ev: Event) => {
      const detail = (ev as CustomEvent<RecoveryTransitionDetail>).detail || {};
      const reason = detail.reason || "route-recovery";
      maybeShowMicroRecovery(detail.message || "Restoring SOCIO", reason);
    };

    const onRecoveryStop = (ev: Event) => {
      const detail = (ev as CustomEvent<RecoveryTransitionDetail>).detail || {};
      stopMicroRecoveryReason(detail.reason || "route-recovery");
    };

    window.addEventListener(NATIVE_TRANSITION_EVENT_NAMES.auth, onAuthTransition as EventListener);
    window.addEventListener(NATIVE_TRANSITION_EVENT_NAMES.recoveryStart, onRecoveryStart as EventListener);
    window.addEventListener(NATIVE_TRANSITION_EVENT_NAMES.recoveryStop, onRecoveryStop as EventListener);

    return () => {
      window.removeEventListener(NATIVE_TRANSITION_EVENT_NAMES.auth, onAuthTransition as EventListener);
      window.removeEventListener(NATIVE_TRANSITION_EVENT_NAMES.recoveryStart, onRecoveryStart as EventListener);
      window.removeEventListener(NATIVE_TRANSITION_EVENT_NAMES.recoveryStop, onRecoveryStop as EventListener);
    };
  }, [mode]);

  useEffect(() => {
    if (pendingAuthTimerRef.current) clearTimeout(pendingAuthTimerRef.current);
    if (mode === "full-intro") return;

    if (authLoading) {
      pendingAuthTimerRef.current = setTimeout(
        () => maybeShowMicroRecovery("Restoring your session", "auth"),
        RECOVERY_THRESHOLD_MS
      );
      return;
    }

    stopMicroRecoveryReason("auth");
    stopRecoveryTransition("auth");
  }, [authLoading, mode]);

  useEffect(() => {
    if (pendingEventsTimerRef.current) clearTimeout(pendingEventsTimerRef.current);
    if (mode === "full-intro" || isScannerRoute) return;

    if (eventsLoading) {
      pendingEventsTimerRef.current = setTimeout(
        () => maybeShowMicroRecovery("Syncing events", "events"),
        RECOVERY_THRESHOLD_MS
      );
      return;
    }

    stopMicroRecoveryReason("events");
    stopRecoveryTransition("events");
  }, [eventsLoading, isScannerRoute, mode]);

  useEffect(() => {
    const handleOffline = () => maybeShowMicroRecovery("Waiting for connection", "network-reconnect");
    const handleOnline = () => stopMicroRecoveryReason("network-reconnect");

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      if (pendingAuthTimerRef.current) clearTimeout(pendingAuthTimerRef.current);
      if (pendingEventsTimerRef.current) clearTimeout(pendingEventsTimerRef.current);
    };
  }, []);

  if (mode === "none" || mode === "pending" || mode === "micro-splash") return null;

  if (mode === "full-intro") {
    return (
      <FirstLaunchPanel
        stageIndex={launchStageIndex}
        progress={progress}
        exiting={closing}
        done={steps.authReady && steps.scannerReady && steps.eventsReady && steps.storageReady}
      />
    );
  }

  if (mode === "account-transition") {
    return (
      <OperationalPanel
        operation="auth.switch"
        message={accountMessage}
        progress={undefined}
        blocking
        scannerSafe={isScannerRoute}
        exiting={closing}
      />
    );
  }

  return (
    <RecoveryCard
      operation={recoveryOp}
      message={recoveryMessage}
      scannerSafe={isScannerRoute}
      exiting={closing}
    />
  );
}
