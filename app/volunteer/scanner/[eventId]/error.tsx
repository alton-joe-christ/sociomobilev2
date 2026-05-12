"use client";

import { useEffect } from "react";
import { AlertTriangleIcon, RefreshCcwIcon } from "@/components/icons";
import { useRouter } from "next/navigation";

export default function ScannerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[FatalScannerTrace] SCANNER ERROR BOUNDARY CAUGHT ERROR:", {
      message: error.message,
      name: error.name,
      digest: error.digest,
      stack: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      navigator: typeof navigator !== 'undefined' ? {
        onLine: navigator.onLine,
        userAgent: navigator.userAgent
      } : null,
      serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? !!navigator.serviceWorker.controller : false,
      localStorage: typeof localStorage !== 'undefined' ? { ...localStorage } : {},
      sessionStorage: typeof sessionStorage !== 'undefined' ? { ...sessionStorage } : {},
    });
  }, [error]);

  const handleHardReset = () => {
    // Attempt to forcefully clean up any DOM artifacts
    document.body.classList.remove("barcode-scanner-active");
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(v => {
      try {
        const stream = v.srcObject as MediaStream;
        stream?.getTracks().forEach(t => t.stop());
        v.srcObject = null;
      } catch (e) {
        console.error("[FatalScannerTrace] Failed to stop video stream during hard reset", e);
      }
    });

    // Reset the boundary
    reset();
  };

  return (
    <div className="pwa-page flex flex-col items-center justify-center bg-[var(--color-bg)] px-6 min-h-screen">
      <div className="w-full max-w-md bg-white p-8 rounded-[30px] shadow-sm border border-[var(--color-border)] text-center">
        <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
          <AlertTriangleIcon size={32} />
        </div>
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">
          Scanner encountered an error
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6 break-words">
          An unexpected issue occurred while initializing the camera or scanner. Please reload to try again.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleHardReset}
            className="w-full btn btn-primary flex items-center justify-center gap-2"
          >
            <RefreshCcwIcon size={18} />
            Recover Scanner
          </button>
          <button
            onClick={() => router.replace("/volunteer")}
            className="w-full py-3 px-4 rounded-[16px] border border-[var(--color-border)] text-[var(--color-text)] font-semibold active:scale-95 transition-transform"
          >
            Go back to events
          </button>
        </div>
      </div>
    </div>
  );
}
