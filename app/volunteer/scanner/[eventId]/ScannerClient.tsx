"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth, type VolunteerEvent } from "@/context/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  QrCodeIcon,
  CameraIcon,
} from "@/components/icons";
import { getActiveVolunteerEvents } from "@/lib/volunteerAccess";
import { apiRequest } from "@/lib/apiClient";
import { formatDateShort } from "@/lib/dateUtils";
import {
  getScanner,
  type IScanner,
  type ScannerResult,
  type PermissionStatus,
} from "@/lib/ScannerService";
import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { startRecoveryTransition, stopRecoveryTransition } from "@/lib/nativeLaunchState";

const DENIED_MESSAGE = "You do not have permission to access this feature";

type ScanStatus = "success" | "duplicate" | "error" | "unauthorized" | "offline";

interface ScanToast {
  id: string;
  type: ScanStatus;
  name: string;
  message: string;
  timestamp: Date;
  exiting?: boolean;
}

interface HistoryRow {
  id: string;
  name: string;
  status: ScanStatus;
  time: Date;
}

interface QueuedScan {
  id: string;
  payload: unknown;
  timestamp: number;
}

/** Auto-dismiss durations per toast type (ms) */
const TOAST_MS: Record<ScanStatus, number> = {
  success:      1200,
  duplicate:    1800,
  error:        2000,
  unauthorized: 2000,
  offline:      2000,
};

const TOAST_ICON: Record<ScanStatus, string> = {
  success:      "✅",
  duplicate:    "⚠️",
  error:        "❌",
  unauthorized: "🚫",
  offline:      "📡",
};

const ROW_ICON: Record<ScanStatus, string> = {
  success:      "✓",
  duplicate:    "⚠",
  error:        "✕",
  unauthorized: "✕",
  offline:      "↑",
};

export default function ScannerClient() {
  const params  = useParams();
  const router  = useRouter();
  const eventId = String(params?.eventId || "");
  const { session, userData, isLoading: authLoading } = useAuth();

  /* ── Access state ── */
  const [isChecking,   setIsChecking]   = useState(true);
  const [event,        setEvent]        = useState<VolunteerEvent | null>(null);
  const [accessError,  setAccessError]  = useState<string | null>(null);

  /* ── Scanner state ── */
  const [isScanning,   setIsScanning]   = useState(false);
  const [permission,   setPermission]   = useState<PermissionStatus>("prompt");
  const [cameraError,  setCameraError]  = useState<string | null>(null);

  /* ── UX state ── */
  const [history,      setHistory]      = useState<HistoryRow[]>([]);
  const [toasts,       setToasts]       = useState<ScanToast[]>([]);
  const [syncQueue,    setSyncQueue]    = useState<QueuedScan[]>([]);
  const [scanCount,    setScanCount]    = useState(0);
  const [viewportStatus, setViewportStatus] = useState<"idle"|"success"|"duplicate"|"error">("idle");
  const [isVerifying,  setIsVerifying]  = useState(false);

  /* ── Refs ── */
  const videoRef          = useRef<HTMLVideoElement | null>(null);
  const scannerRef        = useRef<IScanner | null>(null);
  const cooldownMapRef    = useRef<Map<string, number>>(new Map());
  const attendeeCacheRef  = useRef<Map<string, { name: string; status: string }>>(new Map());
  const toastTimersRef    = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const viewportTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef        = useRef(true);

  const isNative = useMemo(() => Capacitor.isNativePlatform(), []);

  const cachedEvent = useMemo(() =>
    getActiveVolunteerEvents(userData?.volunteerEvents).find(
      (e) => e.event_id === eventId
    ) ?? null,
  [eventId, userData?.volunteerEvents]);

  /* ── Component Lifecycle ── */
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ── UX & Toast system ── */
  const pushToast = useCallback((t: Omit<ScanToast, "id" | "timestamp">) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    setToasts(prev => [{ ...t, id, timestamp: new Date() }, ...prev].slice(0, 3));

    const timer = setTimeout(() => {
      setToasts(prev => prev.map(x => x.id === id ? { ...x, exiting: true } : x));
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== id));
        toastTimersRef.current.delete(id);
      }, 140);
    }, TOAST_MS[t.type]);

    toastTimersRef.current.set(id, timer);
  }, []);

  const flashViewport = useCallback((s: "success" | "duplicate" | "error") => {
    setViewportStatus(s);
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(() => setViewportStatus("idle"), 500);
  }, []);

  /* ── Haptics ── */
  const haptic = useCallback(async (type: "success" | "warning" | "error") => {
    if (isNative) {
      try {
        await Haptics.notification({
          type: type === "success" ? NotificationType.Success
              : type === "warning" ? NotificationType.Warning
              : NotificationType.Error,
        });
      } catch {}
    } else if ("vibrate" in navigator) {
      navigator.vibrate(type === "success" ? [70] : [50, 40, 50]);
    }
  }, [isNative]);

  /* ── Camera controls ── */
  const stopScanner = useCallback(async () => {
    console.log(`[FatalScannerTrace] Stopping scanner...`);
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
      }
      
      // Hard cleanup of DOM and streams just in case
      document.body.classList.remove("barcode-scanner-active");
      if (videoRef.current) {
        try {
          const stream = videoRef.current.srcObject as MediaStream;
          stream?.getTracks().forEach(t => t.stop());
          videoRef.current.srcObject = null;
        } catch (e) {
          console.error(`[FatalScannerTrace] Error cleaning up video stream:`, e);
        }
      }
    } catch (err) {
      console.error(`[FatalScannerTrace] Error during scanner stop:`, err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  /* ── Core scan processor (backend-authoritative) ── */
  const processScan = useCallback(async (result: ScannerResult) => {
    if (!session?.access_token || !event) return;

    const qrData = result.data;
    const now    = Date.now();
    const last   = cooldownMapRef.current.get(qrData);
    if (last && now - last < 2500) return;
    cooldownMapRef.current.set(qrData, now);

    const cached = attendeeCacheRef.current.get(qrData);
    if (cached?.status === "already_present") {
      void haptic("warning");
      flashViewport("duplicate");
      pushToast({ type: "duplicate", name: cached.name, message: "Already checked in" });
      return;
    }

    const payload = {
      qrCodeData: qrData,
      volunteerId: userData?.register_number,
      scannerInfo: {
        source:    "sociomobilev2",
        platform:  Capacitor.getPlatform(),
        format:    result.format,
        timestamp: new Date().toISOString(),
      },
    };

    const recoveryTimer = setTimeout(() => {
      startRecoveryTransition("Verifying attendee…", "scanner-verify");
    }, 700);

    try {
      setIsVerifying(true);
      const res: any = await apiRequest(
        `/events/${encodeURIComponent(event.event_id)}/scan-qr`,
        { method: "POST", body: JSON.stringify(payload), cache: "no-store", timeoutMs: 4000 }
      );
      clearTimeout(recoveryTimer);
      stopRecoveryTransition("scanner-verify");

      const participant = res.participant;
      const finalName   = participant?.name || "Attendee";

      if (participant?.status === "already_present") {
        void haptic("warning");
        flashViewport("duplicate");
        attendeeCacheRef.current.set(qrData, { name: finalName, status: "already_present" });
        pushToast({ type: "duplicate", name: finalName, message: "Already checked in" });
        setHistory(prev => [{ id: `r_${Date.now()}`, name: finalName, status: "duplicate" as ScanStatus, time: new Date() }, ...prev].slice(0, 50));
      } else {
        void haptic("success");
        flashViewport("success");
        attendeeCacheRef.current.set(qrData, { name: finalName, status: "already_present" });
        pushToast({ type: "success", name: finalName, message: "Attendance marked" });
        setHistory(prev => [{ id: `r_${Date.now()}`, name: finalName, status: "success" as ScanStatus, time: new Date() }, ...prev].slice(0, 50));
        setScanCount(prev => prev + 1);
      }
    } catch (err: any) {
      clearTimeout(recoveryTimer);
      stopRecoveryTransition("scanner-verify");
      console.error(`[FatalScannerTrace] processScan failure:`, err);
      const msg = (err.message || "").toLowerCase();
      const isNetworkError = msg.includes("network") || msg.includes("fetch") || err.name === "TimeoutError";
      const isUnauthorized = err.status === 403 || err.status === 429;

      if (isNetworkError) {
        const offlineId = `r_${Date.now()}`;
        setSyncQueue(prev => [...prev, { id: offlineId, payload, timestamp: Date.now() }]);
        pushToast({ type: "offline", name: "Scan queued", message: "Will sync when online" });
        setHistory(prev => [{ id: offlineId, name: "Queued", status: "offline" as ScanStatus, time: new Date() }, ...prev].slice(0, 50));
      } else if (isUnauthorized) {
        void haptic("error");
        flashViewport("error");
        pushToast({ type: "unauthorized", name: "Not assigned", message: "You are not assigned to this event" });
      } else {
        void haptic("error");
        flashViewport("error");
        pushToast({ type: "error", name: "Invalid QR", message: err.message || "QR not recognized" });
      }
    } finally {
      clearTimeout(recoveryTimer);
      stopRecoveryTransition("scanner-verify");
      setIsVerifying(false);
    }
  }, [session, event, userData, haptic, flashViewport, pushToast]);

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraError(null);
    try {
      if (scannerRef.current && isScanning) await stopScanner();
      if (!scannerRef.current) scannerRef.current = getScanner();
      let perm = await scannerRef.current.checkPermission();
      if (perm !== "granted") {
        perm = await scannerRef.current.requestPermission();
        setPermission(perm);
        if (perm !== "granted") throw new Error("Camera permission required");
      }
      await scannerRef.current.start(videoRef.current, r => void processScan(r));
      setIsScanning(true);
    } catch (err: any) {
      setIsScanning(false);
      console.error(`[FatalScannerTrace] Scanner start error:`, err);
      
      const rawMsg = (err.message || "").toLowerCase();
      let safeMsg = "Camera access required";
      
      if (rawMsg.includes("permission") || rawMsg.includes("denied")) {
        safeMsg = "Camera permission denied. Please enable it in settings.";
      } else if (rawMsg.includes("not supported") || rawMsg.includes("unsupported")) {
        safeMsg = "Scanner not supported on this device.";
      } else if (rawMsg.includes("installed") || rawMsg.includes("module")) {
        safeMsg = "Initializing scanner..."; // Usually harmless transient state
      } else if (rawMsg.trim() !== "") {
        safeMsg = "Failed to initialize scanner. Please try again.";
      }

      setCameraError(safeMsg);
      await stopScanner();
    }
  }, [isScanning, processScan, stopScanner]);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!authLoading && !session) router.replace("/auth");
  }, [authLoading, router, session]);

  /* ── Access validation ──
   * The backend /volunteer/events/:eventId/access endpoint is the ONLY authority.
   * - On 403/auth error → block scanner unconditionally
   * - On genuine network error → allow cached event as best-effort fallback
   * - Scanner NEVER opens until this resolves successfully
   */
  useEffect(() => {
    if (authLoading) return;
    if (!eventId || !session?.access_token) {
      setIsChecking(false);
      setAccessError(DENIED_MESSAGE);
      router.replace("/volunteer");
      return;
    }

    let cancelled = false;
    setIsChecking(true);
    setAccessError(null);

    async function validate() {
      try {
        console.log(`[SystemInterruptDebug] Validating access for event: ${eventId}`);
        const res: any = await apiRequest(
          `/volunteer/events/${encodeURIComponent(eventId)}/access`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (res.authorized === false) {
          setEvent(null);
          setAccessError(res.error || DENIED_MESSAGE);
          pushToast({ type: "error", name: "Access Denied", message: res.error || DENIED_MESSAGE });
          setTimeout(() => router.replace("/volunteer"), 1500);
          return;
        }
        // Backend confirmed — use backend event data (most up-to-date)
        setEvent(res.event || cachedEvent);
      } catch (err: any) {
        console.error(`[FatalScannerTrace] Access validation failed:`, {
          error: err,
          message: err.message,
          status: err.status,
          eventId,
          session: !!session?.access_token,
        });
        if (cancelled) return;
        const msg = (err.message || "").toLowerCase();
        
        const isNetworkError =
          msg.includes("network") ||
          msg.includes("fetch") ||
          err.name === "TimeoutError" ||
          err.name === "AbortError";
          
        const isAuthError =
          msg.includes("not assigned") ||
          msg.includes("volunteer access") ||
          msg.includes("archived") ||
          msg.includes("register") ||
          err.status === 401 ||
          err.status === 403;

        if (isAuthError) {
          // Hard block — backend explicitly denied access
          setEvent(null);
          setAccessError(err.message || DENIED_MESSAGE);
          pushToast({ type: "error", name: "Access Denied", message: err.message || DENIED_MESSAGE });
          setTimeout(() => router.replace("/volunteer"), 1500);
        } else if (isNetworkError && cachedEvent) {
          // Network down — allow cached assignment as best-effort
          setEvent(cachedEvent);
        } else {
          // Unknown error without cache — deny for safety
          setEvent(null);
          const fallbackMsg = "Could not verify your assignment. Please try again.";
          setAccessError(fallbackMsg);
          pushToast({ type: "error", name: "Error", message: fallbackMsg });
          setTimeout(() => router.replace("/volunteer"), 1500);
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }
    void validate();
    return () => { cancelled = true; };
  }, [cachedEvent, eventId, authLoading, session, pushToast, router]);

  /* ── Restore session history ── */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`scan_hist_${eventId}`);
      if (raw) {
        const rows: HistoryRow[] = JSON.parse(raw).map((r: any) => ({
          ...r,
          time:   new Date(r.time),
          status: r.status as ScanStatus,
        }));
        setHistory(rows);
        setScanCount(rows.filter(r => r.status === "success").length);
        rows.forEach(r => {
          if (r.status === "success" || r.status === "duplicate") {
            attendeeCacheRef.current.set(r.id, { name: r.name, status: "already_present" });
          }
        });
      }
      const rawQ = localStorage.getItem(`scan_queue_${eventId}`);
      if (rawQ) setSyncQueue(JSON.parse(rawQ));
    } catch {}
  }, [eventId]);

  useEffect(() => {
    if (history.length > 0)
      sessionStorage.setItem(`scan_hist_${eventId}`, JSON.stringify(history));
  }, [history, eventId]);

  useEffect(() => {
    localStorage.setItem(`scan_queue_${eventId}`, JSON.stringify(syncQueue));
  }, [syncQueue, eventId]);


  /* ── Background offline sync ──
   * Must be declared after pushToast (uses it in the catch path).
   * Distinguishes 403/429 (permanent failures) from network errors (transient).
   * Unauthorized or rate-limited scans are permanently dropped with visible feedback.
   */
  useEffect(() => {
    if (syncQueue.length === 0 || !session?.access_token) return;
    const t = setTimeout(async () => {
      const remaining: QueuedScan[] = [];
      for (const item of syncQueue) {
        try {
          await apiRequest(`/events/${encodeURIComponent(eventId)}/scan-qr`, {
            method: "POST",
            body: JSON.stringify(item.payload),
            cache: "no-store",
            timeoutMs: 5000,
          });
        } catch (err: any) {
          console.error(`[FatalScannerTrace] Background sync failure for item ${item.id}:`, err);
          const msg = (err.message || "").toLowerCase();
          const isPermanentFailure =
            msg.includes("not assigned") ||
            msg.includes("volunteer access") ||
            msg.includes("too many") ||
            err.status === 403 ||
            err.status === 429;
          if (isPermanentFailure) {
            // Drop permanently — surface as one toast
            pushToast({ type: "unauthorized", name: "Sync failed", message: "Volunteer access was revoked" });
          } else {
            remaining.push(item); // Retry on transient network errors
          }
        }
      }
      setSyncQueue(remaining);
    }, 5000);
    return () => clearTimeout(t);
  }, [syncQueue, session, eventId, pushToast]);

  /* ── Scanner lifecycle ── */
  useEffect(() => {
    if (isChecking || !event || accessError) return;

    console.log(`[FatalScannerTrace] Scanner authorized and mounted`);
    try {
      scannerRef.current = getScanner();
      void scannerRef.current.checkPermission().then((perm) => {
        if (mountedRef.current) setPermission(perm);
      });
    } catch (err) {
      console.error(`[FatalScannerTrace] getScanner initialization failed on mount:`, err);
    }
    
    return () => {
      console.log(`[FatalScannerTrace] Scanner unmounting, running cleanup`);
      void stopScanner();
      toastTimersRef.current.forEach(clearTimeout);
    };
  }, [isChecking, event, accessError, stopScanner]);


  /* ── Camera controls ── */

  /* ── Status config computation ── */
  const statusConfig = useMemo(() => {
    if (cameraError) return { text: cameraError, tone: "error" as const };
    if (isVerifying) return { text: "Verifying attendee…", tone: "info" as const };
    if (!isScanning) return { text: "Ready to scan", tone: "idle" as const };
    if (viewportStatus === "success") return { text: "Attendance marked", tone: "success" as const };
    if (viewportStatus === "duplicate") return { text: "Duplicate scan detected", tone: "warning" as const };
    if (viewportStatus === "error") return { text: "Invalid QR detected", tone: "error" as const };
    if (syncQueue.length > 0) return { text: `Offline sync pending (${syncQueue.length})`, tone: "warning" as const };
    return { text: "Scanning active", tone: "active" as const };
  }, [cameraError, isVerifying, isScanning, viewportStatus, syncQueue.length]);

  /* ── Loading / Error guards ── */
  if (authLoading || isChecking) return <LoadingScreen />;

  if (!event || accessError) {
    return (
      <div className="pwa-page flex items-center justify-center bg-[var(--color-bg)] px-6">
        <div className="text-center max-w-[300px]">
          <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangleIcon size={28} className="text-[var(--color-danger)]" />
          </div>
          <h1 className="text-[16px] font-bold text-[var(--color-text)]">Access restricted</h1>
          <p className="mt-2 text-[13px] text-[var(--color-text-muted)] leading-relaxed">
            {accessError || "You don't have access to scan this event."}
          </p>
          <button
            onClick={() => router.replace("/volunteer")}
            className="btn btn-primary w-full mt-5 text-sm"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  /* ── Main render ── */
  return (
    <div className={`scan-page${isNative && isScanning ? " scan-native-active" : ""}`}>

      {/* ── Toast Stack ── */}
      <div className="scan-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="alert"
            className={`scan-toast scan-toast-${toast.type}${toast.exiting ? " scan-toast-exit" : ""}`}
          >
            <span className="scan-toast-icon">{TOAST_ICON[toast.type]}</span>
            <div className="scan-toast-body">
              <span className="scan-toast-name">{toast.name}</span>
              <span className="scan-toast-msg">{toast.message}</span>
            </div>
            <span className="scan-toast-time">
              {toast.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <header className="scan-header">
        <button
          className="scan-back-btn"
          aria-label="Go back"
          onClick={() => { void stopScanner(); router.replace("/volunteer"); }}
        >
          <ArrowLeftIcon size={20} />
        </button>

        <div className="scan-header-title">
          <span className="scan-event-name-header">{event.title}</span>
          {isScanning && (
            <span className="scan-live-pill">
              <span className="scan-live-dot" />
              Scanning
            </span>
          )}
        </div>

        <span className="scan-count-badge">{scanCount} scanned</span>
      </header>

      <div className={`scan-status-row scan-status-${statusConfig.tone}`}>
        <span className="scan-status-dot" />
        <span className="scan-status-text">{statusConfig.text}</span>
      </div>

      <div className="scan-main-column px-4 pt-4 pb-6 max-w-[480px] mx-auto space-y-4">
        {/* ── Camera Viewport ── */}
        <section
          id="scan-viewport"
          className={`scan-viewport scan-viewport-${viewportStatus}`}
          aria-label="Camera scanner"
        >
          <div className="scan-viewport-camera">
            <video
              ref={videoRef}
              className={`scan-video${isNative ? " scan-video-native" : ""}`}
              muted
              playsInline
              autoPlay
            />

            <div className="scan-viewport-glow" aria-hidden="true" />

            {/* Corner brackets + sweep line */}
            {isScanning && (
              <div className="scan-frame" aria-hidden="true">
                <div className="scan-corner scan-corner-tl" />
                <div className="scan-corner scan-corner-tr" />
                <div className="scan-corner scan-corner-bl" />
                <div className="scan-corner scan-corner-br" />
                <div className="scan-line" />
              </div>
            )}

            {/* Idle state */}
            {!isScanning && (
              <div className="scan-idle-overlay">
                <CameraIcon size={36} className="scan-idle-icon" />
                {cameraError && <p className="scan-camera-error">{cameraError}</p>}
                <button
                  id="start-scanning-btn"
                  className="scan-start-btn"
                  onClick={() => void startScanner()}
                >
                  Start scanning
                </button>
              </div>
            )}
          </div>

          <div className="scan-terminal-panel">
            <div className="scan-terminal-copy">
              <p className="scan-terminal-meta">{statusConfig.text}</p>
            </div>

            <div className="scan-terminal-actions">
              <span className={`scan-terminal-badge${isScanning ? " scan-terminal-badge-active" : ""}`}>
                {isScanning ? "Camera live" : "Camera idle"}
              </span>
              {isScanning && (
                <button
                  className="scan-stop-btn scan-stop-btn-inline"
                  aria-label="Stop scanning"
                  onClick={() => void stopScanner()}
                >
                  Stop scanning
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Recent Scans ── */}
        <section className="scan-history-section" aria-label="Recent scans">
          <p className="scan-history-label">
            Recent scans
            {syncQueue.length > 0 && (
              <span className="scan-sync-badge">● {syncQueue.length} pending sync</span>
            )}
          </p>

          <div className="scan-history-list" id="scan-history-list">
            {history.length === 0 ? (
              <div className="scan-history-empty">
                <QrCodeIcon size={22} />
                <span>No scans yet</span>
              </div>
            ) : (
              history.slice(0, 20).map(row => (
                <div key={row.id} className={`scan-row scan-row-${row.status}`}>
                  <span className="scan-row-icon">{ROW_ICON[row.status]}</span>
                  <span className="scan-row-name">{row.name}</span>
                  <span className="scan-row-time">
                    {row.time.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
