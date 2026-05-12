"use client";

import { useEffect } from "react";
import { RefreshCcwIcon, AlertTriangleIcon } from "@/components/icons";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Check if it's a ChunkLoadError
    const isChunkError =
      error.name === "ChunkLoadError" ||
      error.message.includes("Loading chunk") ||
      error.message.includes("Failed to fetch dynamically imported module");

    if (isChunkError) {
      window.location.reload();
    }

    console.error("[SystemInterruptDebug] Uncaught Runtime Error:", {
      message: error.message,
      name: error.name,
      digest: error.digest,
      stack: error.stack,
      url: window.location.href,
      localStorage: { ...localStorage }, // Be careful with secrets, but useful for state debug
      sessionStorage: { ...sessionStorage },
    });
    console.error("Uncaught Runtime Error:", error);

  }, [error]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden bg-[#f8fafc]">
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-[var(--color-primary-light)] rounded-full blur-[100px] opacity-50 animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] bg-[var(--color-accent-light)] rounded-full blur-[80px] opacity-40" />

      <div className="relative z-10 w-full max-w-[360px] bg-white/70 backdrop-blur-xl rounded-[40px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-white flex flex-col items-center text-center animate-fade-up">
        {/* Icon Container */}
        <div className="mb-6 w-20 h-20 rounded-3xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center shadow-inner relative overflow-hidden group">
          <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <AlertTriangleIcon size={36} className="text-red-500 drop-shadow-sm" />
        </div>
        
        <h2 className="text-[26px] font-black tracking-tight text-[var(--color-text)] leading-tight">
          System Interrupted
        </h2>
        
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-text-muted)] font-medium">
          The application hit a minor snag. This usually fixes itself with a quick retry.
        </p>

        <div className="mt-10 w-full space-y-3">
          <button
            onClick={() => reset()}
            className="w-full h-14 bg-[var(--color-primary-dark)] text-white rounded-[20px] text-[15px] font-black shadow-lg shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full h-14 bg-white/50 border border-[var(--color-border)] text-[var(--color-text)] rounded-[20px] text-[15px] font-bold active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-white/80"
          >
            <RefreshCcwIcon size={18} className="opacity-60" />
            Force Refresh
          </button>
        </div>

        {error.digest && (
          <div className="mt-8 pt-6 border-t border-dashed border-gray-200 w-full">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-light)]">
              Error Hash
            </div>
            <div className="mt-1 text-[11px] font-mono text-[var(--color-text-muted)] bg-gray-50 py-1.5 px-3 rounded-lg break-all">
              {error.digest}
            </div>
          </div>
        )}
      </div>

      {/* Brand Label */}
      <div className="mt-12 opacity-30 text-[12px] font-black tracking-[0.3em] uppercase pointer-events-none select-none">
        SOCIO MOBILE
      </div>
    </div>
  );
}
