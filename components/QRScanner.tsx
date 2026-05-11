"use client";

import { useEffect, useRef, useState, useMemo, memo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { AlertTriangleIcon, CameraIcon, CheckCircleIcon, QrCodeIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/Button";
import { apiRequest } from "@/lib/apiClient";
import { getScanner, IScanner, ScannerResult, PermissionStatus } from "@/lib/ScannerService";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import toast from "react-hot-toast";

interface QRScannerProps {
  eventId: string;
  onScanSuccess?: (result: any) => void;
}

interface HistoryItem {
  id: string;
  qrData: string;
  name?: string;
  status: "success" | "already_present" | "error";
  time: Date;
  message?: string;
}

/**
 * MEMOIZED OVERLAY UI
 * Isolates the scanner overlay from main component rerenders
 */
const ScannerOverlay = memo(({ isScanning, isNative }: { isScanning: boolean; isNative: boolean }) => {
  if (!isScanning) return null;

  return (
    <>
      <div className="pointer-events-none absolute inset-6 z-10">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-[16px]" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-[16px]" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-[16px]" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-[16px]" />
      </div>
      <div className="pointer-events-none absolute left-6 right-6 h-[1px] bg-emerald-400 shadow-[0_0_8px_4px_rgba(52,211,153,0.4)] animate-scanner-laser z-10" />
    </>
  );
});

ScannerOverlay.displayName = "ScannerOverlay";

export default function QRScanner({ eventId, onScanSuccess }: QRScannerProps) {
  const { session, userData } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<IScanner | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus>('prompt');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const attendeeCacheRef = useRef<Map<string, { name: string; status: string }>>(new Map());

  const isNative = useMemo(() => Capacitor.isNativePlatform(), []);

  useEffect(() => {
    scannerRef.current = getScanner();
    void scannerRef.current.checkPermission().then(setPermission);
    
    return () => {
      void scannerRef.current?.stop();
    };
  }, []);

  const triggerFeedback = useCallback(async (type: "success" | "error" | "warning") => {
    // Haptics
    if (isNative) {
      const hapticType = type === "success" ? NotificationType.Success : 
                         type === "warning" ? NotificationType.Warning : 
                         NotificationType.Error;
      await Haptics.notification({ type: hapticType });
    } else if ("vibrate" in navigator) {
      navigator.vibrate(type === "success" ? 200 : [100, 50, 100]);
    }

    // Audio
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(type === "success" ? 880 : 220, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + (type === "success" ? 0.15 : 0.3));
    } catch (e) {}
  }, [isNative]);

  const processScan = async (scanResult: ScannerResult) => {
    if (!session?.access_token) return;

    const qrCodeData = scanResult.data;
    const now = Date.now();
    const lastScanTime = cooldownMapRef.current.get(qrCodeData);

    // 3 second cooldown for the EXACT same QR code
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
       toast.success(`Already scanned: ${optimisticName}`, { icon: "⚠️" });
       return;
    }

    // Mark locally to prevent concurrent duplicate scans
    attendeeCacheRef.current.set(qrCodeData, { name: optimisticName, status: "already_present" });

    void triggerFeedback("success");

    const historyId = Math.random().toString(36).substr(2, 9);
    const newSuccessItem: HistoryItem = {
      id: historyId,
      qrData: qrCodeData,
      name: optimisticName,
      status: "success",
      time: new Date(),
      message: "Syncing..."
    };
    
    setHistory(prev => [newSuccessItem, ...prev].slice(0, 50)); 
    
    const requestBody = {
      qrCodeData,
      volunteerId: userData?.register_number,
      scannerInfo: {
        source: "sociomobilev2",
        platform: Capacitor.getPlatform(),
        format: scanResult.format,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    };

    // Background Sync
    void (async () => {
      try {
        const payload: any = await apiRequest(`/events/${encodeURIComponent(eventId)}/scan-qr`, {
          method: "POST",
          body: JSON.stringify(requestBody),
          cache: "no-store",
        });

        const participant = payload.participant;
        const isAlreadyPresent = participant?.status === "already_present";
        const finalName = participant?.name || optimisticName;

        attendeeCacheRef.current.set(qrCodeData, {
          name: finalName,
          status: "already_present"
        });

        setHistory(prev => prev.map(item => item.id === historyId ? {
          ...item,
          name: finalName,
          status: isAlreadyPresent ? "already_present" : "success",
          message: isAlreadyPresent ? "Already marked present" : "Attendance marked"
        } : item));

        if (isAlreadyPresent) void triggerFeedback("warning");
        toast.success(isAlreadyPresent ? `Already scanned: ${finalName}` : `Checked in: ${finalName}`, { icon: isAlreadyPresent ? "⚠️" : undefined });
        onScanSuccess?.(payload);
      } catch (err: any) {
        attendeeCacheRef.current.delete(qrCodeData);
        cooldownMapRef.current.set(qrCodeData, 0); 
        const errMsg = err.message || "Invalid QR or Network Error";
        void triggerFeedback("error");
        toast.error(errMsg);
        setHistory(prev => prev.map(item => item.id === historyId ? { ...item, status: "error", message: errMsg } : item));
      }
    })();
  };

  const startScanner = async () => {
    if (!videoRef.current || !scannerRef.current) return;
    if (!session?.access_token) {
      setError("Please sign in again to use the scanner.");
      return;
    }

    try {
      setError(null);
      let currentPermission = await scannerRef.current.checkPermission();
      
      if (currentPermission !== 'granted') {
        currentPermission = await scannerRef.current.requestPermission();
        setPermission(currentPermission);
        if (currentPermission !== 'granted') {
          throw new Error("Camera permission is required to scan QR codes.");
        }
      }

      await scannerRef.current.start(videoRef.current, (result) => {
        void processScan(result);
      });
      
      setIsScanning(true);
    } catch (err: any) {
      console.error("[QRScanner] Scanner failed:", err);
      setIsScanning(false);
      setError(err.message || "Camera access is required.");
    }
  };

  const stopScanner = async () => {
    await scannerRef.current?.stop();
    setIsScanning(false);
  };

  return (
    <div className="space-y-4">
      <div className={`card overflow-hidden ${isScanning && isNative ? 'native-scanning' : ''}`}>
        <div className="p-4">
          <div className={`relative overflow-hidden rounded-[22px] bg-black ${isScanning && isNative ? 'transparent-for-native shadow-none' : ''}`}>
            {/* The video element is only used on Web. On Native, it's hidden and the WebView is made transparent */}
            <video
              ref={videoRef}
              className={`aspect-[4/3] w-full object-cover ${isNative ? 'hidden' : ''}`}
              muted
              playsInline
            />

            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 px-6 text-center text-white">
                <QrCodeIcon size={42} className="mb-3 text-white/70" />
                <p className="text-[14px] font-bold">Scanner locked to this event</p>
                <p className="mt-1 text-[12px] leading-5 text-white/65">
                  Start the camera only when you are ready to scan attendee tickets.
                </p>
              </div>
            )}
            
            <ScannerOverlay isScanning={isScanning} isNative={isNative} />
          </div>

          {permission === 'denied' && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-[12px] font-semibold text-red-700">
              Camera permission is denied. Please enable it in Settings.
            </div>
          )}

          {error && !isScanning && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3">
              <div className="flex items-start gap-2 text-[12px] font-semibold text-red-700">
                <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {!isScanning ? (
              <Button
                variant="primary"
                fullWidth
                onClick={startScanner}
                leftIcon={<CameraIcon size={16} />}
              >
                Start Scanner
              </Button>
            ) : (
              <Button
                variant="danger"
                fullWidth
                onClick={stopScanner}
                leftIcon={<XIcon size={16} />}
              >
                Stop Scanner
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* History Panel */}
      {history.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5 text-[var(--color-text)]">
              <CheckCircleIcon size={14} className="text-[var(--color-text-muted)]" />
              Recent Scans
            </h3>
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
              Last {history.length}
            </span>
          </div>
          <div className="space-y-2">
            {history.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 border border-gray-100 animate-fade-in">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  item.status === 'success' ? 'bg-emerald-100 text-emerald-600' :
                  item.status === 'already_present' ? 'bg-amber-100 text-amber-600' :
                  'bg-red-100 text-red-600'
                }`}>
                  {item.status === 'success' || item.status === 'already_present' ? <CheckCircleIcon size={14} /> : <XIcon size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[var(--color-text)] truncate">
                    {item.name || "Invalid QR"}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                    {item.message}
                  </p>
                </div>
                <div className="text-[10px] font-semibold text-[var(--color-text-light)] whitespace-nowrap">
                  {item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
