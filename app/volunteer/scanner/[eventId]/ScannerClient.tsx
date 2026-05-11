"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, type VolunteerEvent } from "@/context/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";
import { Button } from "@/components/Button";
import { 
  AlertTriangleIcon, 
  ArrowLeftIcon, 
  QrCodeIcon, 
  ShieldCheckIcon,
  CheckCircleIcon,
  XIcon,
  CameraIcon
} from "@/components/icons";
import { getActiveVolunteerEvents } from "@/lib/volunteerAccess";
import { apiRequest } from "@/lib/apiClient";
import { getScanner, IScanner, ScannerResult, PermissionStatus } from "@/lib/ScannerService";
import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { AnimatePresence, motion } from "framer-motion";

const DENIED_MESSAGE = "You do not have permission to access this feature";

interface HistoryItem {
  id: string;
  qrData: string;
  name?: string;
  status: "success" | "already_present" | "error";
  time: Date;
  message?: string;
}

export default function ScannerClient() {
  const params = useParams();
  const router = useRouter();
  const eventId = String(params?.eventId || "");
  const { session, userData, isLoading: authLoading } = useAuth();
  
  // State
  const [isChecking, setIsChecking] = useState(true);
  const [event, setEvent] = useState<VolunteerEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus>('prompt');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lastScanResult, setLastScanResult] = useState<HistoryItem | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<IScanner | null>(null);
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const attendeeCacheRef = useRef<Map<string, { name: string; status: string }>>(new Map());
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNative = useMemo(() => Capacitor.isNativePlatform(), []);

  const cachedEvent = useMemo(() => {
    return getActiveVolunteerEvents(userData?.volunteerEvents).find(
      (item) => item.event_id === eventId
    ) || null;
  }, [eventId, userData?.volunteerEvents]);

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !session) {
      router.replace("/auth");
    }
  }, [authLoading, router, session]);

  // Access Validation
  useEffect(() => {
    if (authLoading) return;
    if (!eventId || !session?.access_token) {
      setIsChecking(false);
      setError(DENIED_MESSAGE);
      return;
    }

    const isAlreadyValidated = !!cachedEvent;
    if (isAlreadyValidated) {
      setEvent(cachedEvent);
      setIsChecking(false);
    }

    let cancelled = false;
    async function validateAccess() {
      if (!isAlreadyValidated) setIsChecking(true);
      setError(null);
      
      try {
        const payload: any = await apiRequest(`/volunteer/events/${encodeURIComponent(eventId)}/access`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (payload.authorized === false) {
          setEvent(null);
          setError(payload.error || DENIED_MESSAGE);
          return;
        }
        const updatedEvent = payload.event || cachedEvent;
        setEvent(updatedEvent);
      } catch (err: any) {
        if (!cancelled) {
          if (cachedEvent) setEvent(cachedEvent);
          else {
            setEvent(null);
            setError(err.message || "Unable to validate scanner access.");
          }
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }
    void validateAccess();
    return () => { cancelled = true; };
  }, [cachedEvent, eventId, authLoading, session]);

  // History Persistence
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`scanner_history_${eventId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const historyItems = parsed.map((item: any) => ({ ...item, time: new Date(item.time) }));
        setHistory(historyItems);
        historyItems.forEach((item: HistoryItem) => {
          if (item.status === "success" || item.status === "already_present") {
            attendeeCacheRef.current.set(item.qrData, { name: item.name || "Attendee", status: "already_present" });
          }
        });
      }
    } catch {}
  }, [eventId]);

  useEffect(() => {
    if (history.length > 0) {
      sessionStorage.setItem(`scanner_history_${eventId}`, JSON.stringify(history));
    }
  }, [history, eventId]);

  // Lifecycle
  useEffect(() => {
    scannerRef.current = getScanner();
    void scannerRef.current.checkPermission().then(setPermission);
    return () => {
      void scannerRef.current?.stop();
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const triggerFeedback = useCallback(async (type: "success" | "error" | "warning") => {
    if (isNative) {
      const hapticType = type === "success" ? NotificationType.Success : 
                         type === "warning" ? NotificationType.Warning : 
                         NotificationType.Error;
      await Haptics.notification({ type: hapticType });
    } else if ("vibrate" in navigator) {
      navigator.vibrate(type === "success" ? 200 : [100, 50, 100]);
    }

    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(type === "success" ? 880 : 220, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + (type === "success" ? 0.15 : 0.3));
    } catch (e) {}
  }, [isNative]);

  const showFeedback = (item: HistoryItem, duration = 4000) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setLastScanResult(item);
    feedbackTimeoutRef.current = setTimeout(() => {
      setLastScanResult(null);
    }, duration);
  };

  const processScan = async (scanResult: ScannerResult) => {
    if (!session?.access_token || !event) return;

    const qrCodeData = scanResult.data;
    const now = Date.now();
    const lastScanTime = cooldownMapRef.current.get(qrCodeData);

    // Cooldown check
    if (lastScanTime && now - lastScanTime < 3000) return; 
    cooldownMapRef.current.set(qrCodeData, now);

    let optimisticName = "Attendee";
    let isLocallyPresent = false;

    const cached = attendeeCacheRef.current.get(qrCodeData);
    if (cached) {
       optimisticName = cached.name || optimisticName;
       isLocallyPresent = cached.status === "already_present";
    } else {
       try {
         const parsed = JSON.parse(qrCodeData);
         if (parsed.name) optimisticName = parsed.name;
       } catch {}
    }

    if (isLocallyPresent) {
       void triggerFeedback("warning");
       const item: HistoryItem = { id: Math.random().toString(), qrData: qrCodeData, name: optimisticName, status: "already_present", time: new Date(), message: "Already scanned" };
       showFeedback(item);
       return;
    }

    attendeeCacheRef.current.set(qrCodeData, { name: optimisticName, status: "already_present" });
    void triggerFeedback("success");

    const historyId = Math.random().toString(36).substr(2, 9);
    const newSuccessItem: HistoryItem = { id: historyId, qrData: qrCodeData, name: optimisticName, status: "success", time: new Date(), message: "Syncing..." };
    
    setHistory(prev => [newSuccessItem, ...prev].slice(0, 50)); 
    showFeedback(newSuccessItem);
    
    const requestBody = {
      qrCodeData,
      volunteerId: userData?.register_number,
      scannerInfo: { source: "sociomobilev2", platform: Capacitor.getPlatform(), format: scanResult.format, userAgent: navigator.userAgent, timestamp: new Date().toISOString() },
    };

    try {
      const payload: any = await apiRequest(`/events/${encodeURIComponent(event.event_id)}/scan-qr`, {
        method: "POST",
        body: JSON.stringify(requestBody),
        cache: "no-store",
      });

      const participant = payload.participant;
      const isAlreadyPresent = participant?.status === "already_present";
      const finalName = participant?.name || optimisticName;

      attendeeCacheRef.current.set(qrCodeData, { name: finalName, status: "already_present" });

      const updatedItem: HistoryItem = { ...newSuccessItem, name: finalName, status: isAlreadyPresent ? "already_present" : "success", message: isAlreadyPresent ? "Attendance confirmed" : "Attendance marked" };
      
      setHistory(prev => prev.map(item => item.id === historyId ? updatedItem : item));
      if (lastScanResult?.id === historyId) setLastScanResult(updatedItem);
      
      if (isAlreadyPresent) void triggerFeedback("warning");
    } catch (err: any) {
      attendeeCacheRef.current.delete(qrCodeData);
      cooldownMapRef.current.set(qrCodeData, 0); 
      const errMsg = err.message || "Invalid QR or Network Error";
      void triggerFeedback("error");
      const errorItem: HistoryItem = { ...newSuccessItem, status: "error", message: errMsg };
      setHistory(prev => prev.map(item => item.id === historyId ? errorItem : item));
      if (lastScanResult?.id === historyId) setLastScanResult(errorItem);
    }
  };

  const startScanner = async () => {
    if (!videoRef.current || !scannerRef.current) return;
    try {
      setScannerError(null);
      let currentPermission = await scannerRef.current.checkPermission();
      if (currentPermission !== 'granted') {
        currentPermission = await scannerRef.current.requestPermission();
        setPermission(currentPermission);
        if (currentPermission !== 'granted') throw new Error("Camera permission is required");
      }
      await scannerRef.current.start(videoRef.current, (result) => void processScan(result));
      setIsScanning(true);
      document.body.classList.add('scanner-mode-active');
    } catch (err: any) {
      setIsScanning(false);
      setScannerError(err.message || "Camera access required");
    }
  };

  const stopScanner = async () => {
    await scannerRef.current?.stop();
    setIsScanning(false);
    document.body.classList.remove('scanner-mode-active');
  };

  if (authLoading || (isChecking && !event)) return <LoadingScreen />;

  if (!event || error) {
    return (
      <div className="pwa-page px-4 pt-[calc(var(--nav-height)+var(--safe-top)+16px)] bg-slate-50">
        <div className="mx-auto max-w-[420px] card p-8 text-center space-y-4">
          <AlertTriangleIcon size={48} className="mx-auto text-red-500" />
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{error || DENIED_MESSAGE}</p>
          <Button variant="primary" fullWidth onClick={() => router.replace("/volunteer")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`pwa-page ${isScanning ? 'scanner-mode-active' : 'bg-slate-50'}`}>
      
      {/* Premium Floating Header */}
      <header className="scanner-header-glass">
        <button onClick={() => isScanning ? stopScanner() : router.replace("/volunteer")} className="p-2 -ml-2 text-white/80 active:scale-95 transition-transform">
          <ArrowLeftIcon size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-white truncate leading-tight">{event.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <div className={`status-indicator ${isScanning ? 'text-emerald-400' : 'text-slate-400'}`} style={{ color: 'currentColor' }} />
            <span className="text-[10px] font-bold text-white/60 tracking-wider uppercase">
              {isScanning ? 'Live Scanner' : 'Scanner Ready'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
          <ShieldCheckIcon size={14} />
          <span className="text-[10px] font-black uppercase tracking-tight">Verified</span>
        </div>
      </header>

      <div className="mx-auto max-w-[420px] px-4 space-y-6 pt-[calc(var(--nav-height)+var(--safe-top)+40px)]">
        
        {/* Immersive Viewport */}
        <section className={`scanner-viewport-premium ${isScanning ? 'scanning-active' : ''}`}>
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transition-opacity duration-500 ${isNative ? 'opacity-0' : 'opacity-100'}`}
            muted
            playsInline
          />
          
          <AnimatePresence>
            {!isScanning && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/80 text-white px-8 text-center backdrop-blur-sm"
              >
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-6 border border-white/20 shadow-2xl">
                  <CameraIcon size={36} className="text-white" />
                </div>
                <h3 className="text-lg font-black tracking-tight">Initialize Camera</h3>
                <p className="text-xs text-white/60 mt-2 leading-relaxed max-w-[200px]">
                  Align ticket QR code within the illuminated guides
                </p>
                <button onClick={startScanner} className="mt-8 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full font-bold text-sm shadow-xl transition-all active:scale-95">
                  Activate Scanner
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* New Premium Guides */}
          {isScanning && (
            <>
              <div className="scanner-guide-corner guide-tl" />
              <div className="scanner-guide-corner guide-tr" />
              <div className="scanner-guide-corner guide-bl" />
              <div className="scanner-guide-corner guide-br" />
              <div className="scanner-laser-premium" />
            </>
          )}

          {scannerError && (
             <div className="absolute bottom-6 left-6 right-6 z-40 p-4 bg-red-500/90 backdrop-blur-md rounded-2xl border border-red-400/50 flex items-center gap-3 text-white">
                <AlertTriangleIcon size={20} className="shrink-0" />
                <p className="text-xs font-bold leading-tight">{scannerError}</p>
             </div>
          )}
        </section>

        {/* Controls (Hidden when scanning for maximum immersion) */}
        {!isScanning && (
          <div className="grid grid-cols-2 gap-3 stagger">
            <div className="card p-4 bg-white shadow-sm flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Scans</span>
              <span className="text-2xl font-black text-slate-900">{history.length}</span>
            </div>
            <div className="card p-4 bg-white shadow-sm flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</span>
              <span className="text-sm font-black text-emerald-600 uppercase">Online</span>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="flex justify-center">
             <button onClick={stopScanner} className="px-8 py-3 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all">
               Deactivate
             </button>
          </div>
        )}

        {/* Pro History Ledger */}
        <section className={`space-y-4 pb-12 transition-all duration-500 ${isScanning ? 'opacity-20 blur-sm scale-95' : 'opacity-100'}`}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Attendance Ledger</h2>
            <div className="h-px flex-1 mx-4 bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-400">{history.length} records</span>
          </div>

          <div className="scanner-ledger space-y-2">
            {history.length === 0 ? (
              <div className="py-12 text-center opacity-30">
                <QrCodeIcon size={40} className="mx-auto mb-3" />
                <p className="text-xs font-bold">Waiting for scans...</p>
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="ledger-item group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    item.status === 'success' ? 'bg-emerald-100 text-emerald-600' :
                    item.status === 'already_present' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {item.status === 'error' ? <XIcon size={18} /> : 
                     item.status === 'already_present' ? <ShieldCheckIcon size={18} /> : <CheckCircleIcon size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate group-active:text-slate-600">{item.name}</p>
                    <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">{item.message}</p>
                  </div>
                  <div className="text-[10px] font-black text-slate-400 tabular-nums">
                    {item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Premium Floating Feedback Bubble */}
      <AnimatePresence>
        {lastScanResult && (
          <div className="scanner-feedback-card">
            <motion.div 
              initial={{ y: 60, opacity: 0, scale: 0.8 }} 
              animate={{ y: 0, opacity: 1, scale: 1 }} 
              exit={{ y: 20, opacity: 0, scale: 0.8 }}
              className={`feedback-bubble ${
                lastScanResult.status === 'success' ? 'feedback-success' :
                lastScanResult.status === 'already_present' ? 'feedback-warning' :
                'feedback-error'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                lastScanResult.status === 'success' ? 'bg-emerald-500 text-white' :
                lastScanResult.status === 'already_present' ? 'bg-amber-500 text-white' :
                'bg-red-500 text-white'
              }`}>
                {lastScanResult.status === 'error' ? <XIcon size={24} /> : 
                 lastScanResult.status === 'already_present' ? <AlertTriangleIcon size={24} /> : <CheckCircleIcon size={24} />}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-black leading-tight text-slate-900 truncate">{lastScanResult.name}</p>
                <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-tight">{lastScanResult.message}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

