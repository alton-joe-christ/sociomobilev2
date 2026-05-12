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
  CameraIcon,
  RefreshCcwIcon,
  HistoryIcon,
  SearchIcon,
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

interface QueuedScan {
  id: string;
  payload: any;
  timestamp: number;
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
  
  // Advanced State
  const [syncQueue, setSyncQueue] = useState<QueuedScan[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeScanResult, setActiveScanResult] = useState<HistoryItem | null>(null);
  const [viewportFlash, setViewportFlash] = useState<"success" | "already_present" | "error" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<IScanner | null>(null);
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const attendeeCacheRef = useRef<Map<string, { name: string; status: string }>>(new Map());

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

  // History & Queue Persistence
  useEffect(() => {
    try {
      // Load History
      const savedHistory = sessionStorage.getItem(`scanner_history_${eventId}`);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        const historyItems = parsed.map((item: any) => ({ ...item, time: new Date(item.time) }));
        setHistory(historyItems);
        historyItems.forEach((item: HistoryItem) => {
          if (item.status === "success" || item.status === "already_present") {
            attendeeCacheRef.current.set(item.qrData, { name: item.name || "Attendee", status: "already_present" });
          }
        });
      }

      // Load Sync Queue
      const savedQueue = localStorage.getItem(`scanner_queue_${eventId}`);
      if (savedQueue) {
        setSyncQueue(JSON.parse(savedQueue));
      }
    } catch {}
  }, [eventId]);

  useEffect(() => {
    if (history.length > 0) {
      sessionStorage.setItem(`scanner_history_${eventId}`, JSON.stringify(history));
    }
  }, [history, eventId]);

  useEffect(() => {
    localStorage.setItem(`scanner_queue_${eventId}`, JSON.stringify(syncQueue));
  }, [syncQueue, eventId]);

  // Background Sync Manager
  useEffect(() => {
    if (syncQueue.length === 0 || isSyncing || !session?.access_token) return;

    const syncTimer = setTimeout(async () => {
      setIsSyncing(true);
      const nextBatch = [...syncQueue];
      const remaining: QueuedScan[] = [];

      for (const item of nextBatch) {
        try {
          await apiRequest(`/events/${encodeURIComponent(eventId)}/scan-qr`, {
            method: "POST",
            body: JSON.stringify(item.payload),
            cache: "no-store",
            timeoutMs: 5000,
          });
          // Update history item to show synced
          setHistory(prev => prev.map(h => h.id === item.id ? { ...h, message: "Synced" } : h));
        } catch (err) {
          remaining.push(item);
        }
      }

      setSyncQueue(remaining);
      setIsSyncing(false);
    }, 5000);

    return () => clearTimeout(syncTimer);
  }, [syncQueue, isSyncing, session, eventId]);

  // Lifecycle
  useEffect(() => {
    scannerRef.current = getScanner();
    void scannerRef.current.checkPermission().then(setPermission);
    return () => {
      void scannerRef.current?.stop();
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

  const triggerPopup = (item: HistoryItem) => {
    setActiveScanResult(item);
    setViewportFlash(item.status);
    
    // Clear popup after 2 seconds
    setTimeout(() => {
      setActiveScanResult(null);
      setViewportFlash(null);
    }, 2000);
  };

  const processScan = async (scanResult: ScannerResult) => {
    if (!session?.access_token || !event) return;

    const qrCodeData = scanResult.data;
    const now = Date.now();
    const lastScanTime = cooldownMapRef.current.get(qrCodeData);

    // Cooldown check (3s for bulk safety)
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
       const item: HistoryItem = { id: Math.random().toString(), qrData: qrCodeData, name: optimisticName, status: "already_present", time: new Date(), message: "Duplicate Scan" };
       triggerPopup(item);
       return;
    }

    // [OPTIMISTIC SUCCESS]
    attendeeCacheRef.current.set(qrCodeData, { name: optimisticName, status: "already_present" });
    void triggerFeedback("success");

    const historyId = Math.random().toString(36).substr(2, 9);
    const optimisticItem: HistoryItem = { id: historyId, qrData: qrCodeData, name: optimisticName, status: "success", time: new Date(), message: "Verifying..." };
    
    setHistory(prev => [optimisticItem, ...prev].slice(0, 50)); 
    triggerPopup(optimisticItem);
    
    const payload = {
      qrCodeData,
      volunteerId: userData?.register_number,
      scannerInfo: { source: "sociomobilev2", platform: Capacitor.getPlatform(), format: scanResult.format, userAgent: navigator.userAgent, timestamp: new Date().toISOString() },
    };

    // Try immediate sync
    try {
      const result: any = await apiRequest(`/events/${encodeURIComponent(event.event_id)}/scan-qr`, {
        method: "POST",
        body: JSON.stringify(payload),
        cache: "no-store",
        timeoutMs: 4000,
      });

      const participant = result.participant;
      const isAlreadyPresent = participant?.status === "already_present";
      const finalName = participant?.name || optimisticName;

      attendeeCacheRef.current.set(qrCodeData, { name: finalName, status: "already_present" });
      const updatedItem: HistoryItem = { ...optimisticItem, name: finalName, status: isAlreadyPresent ? "already_present" : "success", message: isAlreadyPresent ? "Already Confirmed" : "Attendance Marked" };
      
      setHistory(prev => prev.map(item => item.id === historyId ? updatedItem : item));
      if (activeScanResult?.id === historyId) setActiveScanResult(updatedItem);
      
      if (isAlreadyPresent) {
        void triggerFeedback("warning");
        setViewportFlash("already_present");
      }
    } catch (err: any) {
      // Add to background sync queue if it was a network error
      const isNetworkError = err.message?.includes("Network") || err.name === "TimeoutError" || err.message?.includes("failed to fetch");
      if (isNetworkError) {
        setSyncQueue(prev => [...prev, { id: historyId, payload, timestamp: Date.now() }]);
      } else {
        // Validation error
        attendeeCacheRef.current.delete(qrCodeData);
        cooldownMapRef.current.set(qrCodeData, 0); 
        void triggerFeedback("error");
        const errorItem: HistoryItem = { ...optimisticItem, status: "error", message: err.message || "Invalid QR" };
        setHistory(prev => prev.map(item => item.id === historyId ? errorItem : item));
        triggerPopup(errorItem);
      }
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

  const filteredHistory = useMemo(() => {
     if (!searchQuery) return history;
     const q = searchQuery.toLowerCase();
     return history.filter(item => 
        item.name?.toLowerCase().includes(q) || 
        item.message?.toLowerCase().includes(q)
     );
  }, [history, searchQuery]);

  if (authLoading || (isChecking && !event)) return <LoadingScreen />;

  if (!event || error) {
    return (
      <div className="pwa-page px-4 pt-[calc(var(--nav-height)+var(--safe-top)+16px)] bg-slate-50">
        <div className="mx-auto max-w-[420px] card-op text-center py-10 shadow-xl border-none">
          <AlertTriangleIcon size={48} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-black text-slate-900">Access Restricted</h1>
          <p className="mt-2 text-sm font-medium text-slate-500 max-w-[280px] mx-auto leading-relaxed">
             {error || "Operational access denied for this event terminal."}
          </p>
          <div className="mt-8 px-6">
             <Button variant="primary" fullWidth onClick={() => router.replace("/volunteer")}>
                Exit Terminal
             </Button>
          </div>
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
          <h1 className="text-sm font-black text-white truncate leading-tight tracking-tight">{event.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <div className={`status-indicator ${isScanning ? 'text-emerald-400' : 'text-slate-400'}`} style={{ color: 'currentColor' }} />
            <span className="text-[10px] font-black text-white/60 tracking-[0.1em] uppercase">
              {isScanning ? 'Scanner Live' : 'Terminal Standby'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {syncQueue.length > 0 && (
              <div className="h-8 px-2.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center gap-1.5">
                 <RefreshCcwIcon size={12} className="animate-spin" />
                 <span className="text-[10px] font-black">{syncQueue.length}</span>
              </div>
           )}
           <div className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/10 border border-white/20 text-white/80">
             <ShieldCheckIcon size={14} className="text-emerald-400" />
             <span className="text-[10px] font-black uppercase tracking-tight">Lead</span>
           </div>
        </div>
      </header>

      <div className="mx-auto max-w-[440px] px-4 space-y-6 pt-[calc(var(--nav-height)+var(--safe-top)+40px)] pb-20">
        
        {/* Immersive Viewport */}
        <section className={`scanner-viewport-premium ${isScanning ? 'scanning-active' : ''} border-none shadow-2xl shadow-slate-200`}>
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transition-opacity duration-700 ${isNative ? 'opacity-0' : 'opacity-100'}`}
            muted
            playsInline
          />

          {/* Viewport Flash Overlays */}
          <motion.div 
            animate={{ opacity: viewportFlash ? 1 : 0 }}
            className={`viewport-flash flash-${viewportFlash === 'already_present' ? 'warning' : viewportFlash}`} 
          />
          
          <AnimatePresence>
            {!isScanning && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/90 text-white px-8 text-center backdrop-blur-md"
              >
                <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mb-6 border border-white/10 shadow-2xl">
                  <CameraIcon size={40} className="text-white" />
                </div>
                <h3 className="text-lg font-black tracking-tight">Terminal Standby</h3>
                <p className="text-xs text-white/50 mt-2 leading-relaxed max-w-[220px] font-medium">
                  Continuous high-speed scanning mode. Align attendee QR in guides.
                </p>
                <button onClick={startScanner} className="mt-8 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95 shadow-blue-600/20">
                  Activate Terminal
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Premium Operational Guides */}
          {isScanning && (
            <>
              <div className="scanner-roi-box" />
              <div className="scanner-laser-premium" />
            </>
          )}

          {scannerError && (
             <div className="absolute bottom-6 left-6 right-6 z-40 p-4 bg-red-500/90 backdrop-blur-xl rounded-2xl border border-red-400/50 flex items-center gap-3 text-white">
                <AlertTriangleIcon size={20} className="shrink-0" />
                <p className="text-xs font-black leading-tight uppercase tracking-wide">{scannerError}</p>
             </div>
          )}
        </section>

        {/* Operational Stats & Search */}
        {!isScanning && (
          <section className="space-y-4">
             <div className="grid grid-cols-2 gap-3">
                <div className="card-op bg-white border-none shadow-sm p-4 text-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Scanned Today</p>
                   <span className="text-2xl font-black text-slate-900">{history.length}</span>
                </div>
                <div className="card-op bg-white border-none shadow-sm p-4 text-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Queue Status</p>
                   <span className={`text-sm font-black uppercase ${syncQueue.length > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
                     {syncQueue.length > 0 ? 'Synchronizing' : 'Verified'}
                   </span>
                </div>
             </div>

             <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                   <SearchIcon size={16} />
                </div>
                <input 
                  type="text"
                  placeholder="Search local ledger..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 bg-white rounded-2xl pl-11 pr-4 text-sm font-bold text-slate-900 border-none shadow-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300"
                />
             </div>
          </section>
        )}

        {isScanning && (
          <div className="flex justify-center">
             <button onClick={stopScanner} className="px-10 py-3 bg-white/10 backdrop-blur-2xl border border-white/20 text-white rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">
               Deactivate Terminal
             </button>
          </div>
        )}

        {/* Attendance Ledger */}
        <section className={`space-y-4 transition-all duration-700 ${isScanning ? 'opacity-20 blur-md scale-95 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
               <HistoryIcon size={14} className="text-slate-300" />
               Realtime Ledger
            </h2>
            <div className="h-px flex-1 mx-4 bg-slate-200" />
            <span className="text-[10px] font-black text-slate-400 tabular-nums">{filteredHistory.length} ENTRIES</span>
          </div>

          <div className="scanner-ledger space-y-2 border-none bg-white p-3 rounded-[28px] shadow-sm">
            {filteredHistory.length === 0 ? (
              <div className="py-16 text-center opacity-20">
                <QrCodeIcon size={48} className="mx-auto mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">No entries found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((item) => (
                  <div key={item.id} className="ledger-item group border-none bg-slate-50/50 hover:bg-slate-50 active:scale-[0.98] transition-all p-3 rounded-2xl">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                      item.status === 'success' ? 'bg-emerald-100 text-emerald-600' :
                      item.status === 'already_present' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {item.status === 'error' ? <XIcon size={18} /> : 
                       item.status === 'already_present' ? <ShieldCheckIcon size={18} /> : <CheckCircleIcon size={18} />}
                    </div>
                    <div className="flex-1 min-w-0 ml-3">
                      <p className="text-[13px] font-black text-slate-900 truncate group-active:text-slate-600 tracking-tight">{item.name}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${
                         item.status === 'success' ? 'text-emerald-500' :
                         item.status === 'already_present' ? 'text-amber-500' :
                         'text-red-500'
                      }`}>{item.message}</p>
                    </div>
                    <div className="text-[10px] font-black text-slate-300 tabular-nums">
                      {item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Centered Scan Popup */}
      <AnimatePresence>
        {activeScanResult && (
          <div className="scanner-popup-container">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -20 }}
              className="scanner-popup"
            >
              <div className={`popup-icon-wrapper popup-${activeScanResult.status === 'already_present' ? 'warning' : activeScanResult.status}`}>
                {activeScanResult.status === 'success' ? <CheckCircleIcon size={32} /> :
                 activeScanResult.status === 'already_present' ? <AlertTriangleIcon size={32} /> :
                 <XIcon size={32} />}
              </div>
              <h2 className="text-xl font-black text-slate-900 leading-tight truncate w-full px-2">
                {activeScanResult.name}
              </h2>
              <p className={`text-xs font-black uppercase tracking-[0.15em] mt-2 ${
                activeScanResult.status === 'success' ? 'text-emerald-500' :
                activeScanResult.status === 'already_present' ? 'text-amber-500' :
                'text-red-500'
              }`}>
                {activeScanResult.message}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
