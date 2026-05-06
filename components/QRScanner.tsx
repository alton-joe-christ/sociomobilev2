"use client";

import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { useAuth } from "@/context/AuthContext";
import { AlertTriangleIcon, CameraIcon, CheckCircleIcon, QrCodeIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/Button";
import { PWA_API_URL } from "@/lib/apiConfig";

interface QRScannerProps {
  eventId: string;
  onScanSuccess?: (result: ScanPayload) => void;
}

interface ScanResult {
  name?: string;
  email?: string;
  registrationId?: string;
  status?: "marked_present" | "already_present";
  markedAt?: string;
}

interface ScanPayload {
  participant?: ScanResult;
  error?: string;
  message?: string;
}

export default function QRScanner({ eventId, onScanSuccess }: QRScannerProps) {
  const { session, userData } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const isProcessingRef = useRef(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  const stopScanner = () => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setIsScanning(false);
  };

  const playSuccessSound = () => {
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn("Sound feedback failed:", e);
    }
  };

  const resumeScanner = (delayMs: number) => {
    window.setTimeout(() => {
      isProcessingRef.current = false;
      if (scannerRef.current) {
        scannerRef.current.start().catch(() => {
          setError("Unable to restart camera. Tap Start Scanner again.");
          setIsScanning(false);
        });
      }
    }, delayMs);
  };

  const processScan = async (qrCodeData: string) => {
    if (isProcessingRef.current || !session?.access_token) return;
    isProcessingRef.current = true;
    scannerRef.current?.stop();

    try {
      const response = await fetch(`${PWA_API_URL}/events/${encodeURIComponent(eventId)}/scan-qr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          qrCodeData,
          volunteerId: userData?.register_number,
          scannerInfo: {
            source: "sociomobilev2",
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        }),
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => ({}))) as ScanPayload;
      
      if (!response.ok) {
        // ERROR: Red overlay + Haptic (short double)
        setResult(null);
        setError(payload.error || "Unable to process this QR code.");
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
        resumeScanner(2200);
        return;
      }

      // SUCCESS: Green overlay + Haptic (single)
      setError(null);
      setResult(payload.participant || null);
      if ("vibrate" in navigator) navigator.vibrate(200);
      playSuccessSound();
      onScanSuccess?.(payload);
      resumeScanner(3000);
    } catch {
      setResult(null);
      setError("Network error. Please try again.");
      resumeScanner(2200);
    }
  };

  const startScanner = async () => {
    if (!videoRef.current) return;
    if (!session?.access_token) {
      setError("Please sign in again to use the scanner.");
      return;
    }

    try {
      setError(null);
      setResult(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);

      scannerRef.current?.destroy();
      scannerRef.current = new QrScanner(
        videoRef.current,
        (scanResult) => {
          const data = typeof scanResult === "string" ? scanResult : scanResult?.data;
          if (data) void processScan(data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: "environment",
        }
      );

      await scannerRef.current.start();
      setIsScanning(true);
    } catch {
      setHasPermission(false);
      setIsScanning(false);
      setError("Camera access is required to scan QR codes.");
    }
  };

  return (
    <div className="card overflow-hidden">

      <div className="p-4">
        <div className="relative overflow-hidden rounded-[22px] bg-black">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full object-cover"
            muted
            playsInline
          />
          
          {/* Status Overlays */}
          {result && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-emerald-500/90 animate-fade-in">
              <div className="text-center text-white">
                <CheckCircleIcon size={64} className="mx-auto mb-3" />
                <p className="text-[20px] font-black uppercase tracking-tight">
                  {result.status === "already_present" ? "Verified" : "Attendance Marked"}
                </p>
                <p className="mt-1 text-[14px] font-bold opacity-90">{result.name}</p>
              </div>
            </div>
          )}
          
          {error && isScanning && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-500/90 animate-fade-in">
              <div className="text-center text-white p-6">
                <AlertTriangleIcon size={64} className="mx-auto mb-3" />
                <p className="text-[18px] font-black">Scan Failed</p>
                <p className="mt-1 text-[14px] font-bold opacity-90">{error}</p>
              </div>
            </div>
          )}

          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 px-6 text-center text-white">
              <QrCodeIcon size={42} className="mb-3 text-white/70" />
              <p className="text-[14px] font-bold">Scanner locked to this event</p>
              <p className="mt-1 text-[12px] leading-5 text-white/65">
                Start the camera only when you are ready to scan attendee tickets.
              </p>
            </div>
          )}
          {isScanning && !result && !error && (
            <>
              <div className="pointer-events-none absolute inset-6">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[var(--color-accent)] rounded-tl-[16px]" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[var(--color-accent)] rounded-tr-[16px]" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[var(--color-accent)] rounded-bl-[16px]" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[var(--color-accent)] rounded-br-[16px]" />
              </div>
              <div className="pointer-events-none absolute left-6 right-6 h-0.5 bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)] animate-scanner-laser z-10" />
            </>
          )}
        </div>

        {hasPermission === false && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-[12px] font-semibold text-red-700">
            Camera permission is required to scan QR codes.
          </div>
        )}

        {result && (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 text-[13px] font-extrabold text-emerald-800">
              <CheckCircleIcon size={16} />
              {result.status === "already_present" ? "Already scanned" : "Attendance marked"}
            </div>
            <div className="mt-2 space-y-0.5 text-[12px] text-emerald-800">
              {result.name && <p>Name: {result.name}</p>}
              {result.email && <p>Email: {result.email}</p>}
              {result.markedAt && <p>Time: {new Date(result.markedAt).toLocaleString()}</p>}
            </div>
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
  );
}
