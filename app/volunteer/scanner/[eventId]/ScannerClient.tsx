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
import {
  getScanner,
  type IScanner,
  type ScannerResult,
  type PermissionStatus,
} from "@/lib/ScannerService";
import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";

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

  /* ── Refs ── */
  const videoRef          = useRef<HTMLVideoElement | null>(null);
  const scannerRef        = useRef<IScanner | null>(null);
  const cooldownMapRef    = useRef<Map<string, number>>(new Map());
  const attendeeCacheRef  = useRef<Map<string, { name: string; status: string }>>(new Map());
  const toastTimersRef    = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const viewportTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNative = useMemo(() => Capacitor.isNativePlatform(), []);

  const cachedEvent = useMemo(() =>
    getActiveVolunteerEvents(userData?.volunteerEvents).find(
      (e) => e.event_id === eventId
    ) ?? null,
  [eventId, userData?.volunteerEvents]);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!authLoading && !session) router.replace("/auth");
  }, [authLoading, router, session]);

  /* ── Access validation ── */
  useEffect(() => {
    if (authLoading) return;
    if (!eventId || !session?.access_token) {
      setIsChecking(false);
      setAccessError(DENIED_MESSAGE);
      return;
    }

    if (cachedEvent) {
      setEvent(cachedEvent);
      setIsChecking(false);
    }

    let cancelled = false;
    async function validate() {
      if (!cachedEvent) setIsChecking(true);
      setAccessError(null);
      try {
        const res: any = await apiRequest(
          `/volunteer/events/${encodeURIComponent(eventId)}/access`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (res.authorized === false) {
          setEvent(null);
          setAccessError(res.error || DENIED_MESSAGE);
          return;
        }
        setEvent(res.event || cachedEvent);
      } catch (err: any) {
        if (!cancelled) {
          if (cachedEvent) setEvent(cachedEvent);
          else {
            setEvent(null);
            setAccessError(err.message || "Unable to validate access.");
          }
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }
    void validate();
    return () => { cancelled = true; };
  }, [cachedEvent, eventId, authLoading, session]);

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

  /* ── Background sync ── */
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
        } catch {
          remaining.push(item);
        }
      }
      setSyncQueue(remaining);
    }, 5000);
    return () => clearTimeout(t);
  }, [syncQueue, session, eventId]);

  /* ── Scanner lifecycle ── */
  useEffect(() => {
    scannerRef.current = getScanner();
    void scannerRef.current.checkPermission().then(setPermission);
    return () => {
      void scannerRef.current?.stop();
      document.body.classList.remove("barcode-scanner-active");
      toastTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  /* ── Toast system ── */
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

  /* ── Viewport border flash ── */
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

  /* ── Core scan processor ── */
  const processScan = useCallback(async (result: ScannerResult) => {
    if (!session?.access_token || !event) return;

    const qrData = result.data;
    const now    = Date.now();
    const last   = cooldownMapRef.current.get(qrData);
    if (last && now - last < 2500) return;
    cooldownMapRef.current.set(qrData, now);

    /* Locally-known duplicate */
    const cached = attendeeCacheRef.current.get(qrData);
    if (cached?.status === "already_present") {
      void haptic("warning");
      flashViewport("duplicate");
      pushToast({ type: "duplicate", name: cached.name, message: "Already scanned" });
      return;
    }

    /* Optimistic name extraction */
    let name = "Attendee";
    try { const p = JSON.parse(qrData); if (p.name) name = p.name; } catch {}

    /* Optimistic success */
    const rowId = `r_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    void haptic("success");
    flashViewport("success");
    pushToast({ type: "success", name, message: "Marked present" });
    setHistory(prev => [{ id: rowId, name, status: "success" as ScanStatus, time: new Date() }, ...prev].slice(0, 50));
    setScanCount(prev => prev + 1);
    attendeeCacheRef.current.set(qrData, { name, status: "already_present" });

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

    try {
      const res: any = await apiRequest(
        `/events/${encodeURIComponent(event.event_id)}/scan-qr`,
        { method: "POST", body: JSON.stringify(payload), cache: "no-store", timeoutMs: 4000 }
      );

      const participant = res.participant;
      const finalName   = participant?.name || name;
      attendeeCacheRef.current.set(qrData, { name: finalName, status: "already_present" });

      if (participant?.status === "already_present") {
        void haptic("warning");
        flashViewport("duplicate");
        setHistory(prev => prev.map(r => r.id === rowId ? { ...r, name: finalName, status: "duplicate" } : r));
        pushToast({ type: "duplicate", name: finalName, message: "Already scanned" });
      } else {
        setHistory(prev => prev.map(r => r.id === rowId ? { ...r, name: finalName } : r));
      }
    } catch (err: any) {
      const isNetwork = err.message?.toLowerCase().includes("network")
        || err.name === "TimeoutError"
        || err.message?.toLowerCase().includes("fetch");

      if (isNetwork) {
        setSyncQueue(prev => [...prev, { id: rowId, payload, timestamp: Date.now() }]);
        pushToast({ type: "offline", name, message: "Will sync when online" });
      } else {
        void haptic("error");
        flashViewport("error");
        attendeeCacheRef.current.delete(qrData);
        cooldownMapRef.current.set(qrData, 0);
        setHistory(prev => prev.map(r => r.id === rowId ? { ...r, status: "error" } : r));
        setScanCount(prev => Math.max(0, prev - 1));
        pushToast({ type: "error", name: "Invalid QR", message: err.message || "QR not recognized" });
      }
    }
  }, [session, event, userData, haptic, flashViewport, pushToast]);

  /* ── Camera controls ── */
  const startScanner = async () => {
    if (!videoRef.current || !scannerRef.current) return;
    setCameraError(null);
    try {
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
      setCameraError(err.message || "Camera access required");
    }
  };

  const stopScanner = async () => {
    await scannerRef.current?.stop();
    setIsScanning(false);
  };

  /* ── Loading / Error guards ── */
  if (authLoading || (isChecking && !event)) return <LoadingScreen />;

  if (!event || accessError) {
    return (
      <div className="pwa-page flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-[300px]">
          <AlertTriangleIcon size={40} className="mx-auto text-red-500 mb-3" />
          <h1 className="text-lg font-bold text-slate-900">Access Restricted</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {accessError || "You don't have access to scan this event."}
          </p>
          <button
            onClick={() => router.replace("/volunteer")}
            className="mt-6 w-full h-11 bg-slate-900 text-white rounded-xl text-sm font-semibold"
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
          <span className="scan-event-name">{event.title}</span>
          {isScanning && (
            <span className="scan-live-pill">
              <span className="scan-live-dot" />
              Scanning
            </span>
          )}
        </div>

        <span className="scan-count-badge">{scanCount} scanned</span>
      </header>

      {/* ── Camera Viewport ── */}
      <section
        id="scan-viewport"
        className={`scan-viewport scan-viewport-${viewportStatus}`}
        aria-label="Camera scanner"
      >
        <video
          ref={videoRef}
          className={`scan-video${isNative ? " scan-video-native" : ""}`}
          muted
          playsInline
          autoPlay
        />

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
            <p className="scan-idle-label">Ready to scan</p>
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

        {/* In-viewport stop control */}
        {isScanning && (
          <button
            className="scan-stop-btn"
            aria-label="Stop scanning"
            onClick={() => void stopScanner()}
          >
            Stop
          </button>
        )}
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
  );
}
