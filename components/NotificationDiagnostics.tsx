"use client";

import { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

interface DiagData {
  platform: string;
  serviceWorkers: string;
  oneSignal: string;
  permission: string;
  optedIn: string;
  subscriptionId: string;
  lastRefresh: string;
}

export default function NotificationDiagnostics() {
  const [data, setData] = useState<DiagData>({
    platform: "…",
    serviceWorkers: "…",
    oneSignal: "…",
    permission: "…",
    optedIn: "…",
    subscriptionId: "…",
    lastRefresh: "never",
  });
  const [isOpen, setIsOpen] = useState(false);

  const collectData = useCallback(async () => {
    // ── Service Worker registrations ───────────────────────────
    let swStatus = "N/A";
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length === 0) {
          swStatus = "None registered";
        } else {
          swStatus = regs
            .map((r) => {
              const scope = r.scope.replace(location.origin, "");
              const state = r.active?.state ?? (r.installing ? "installing" : "pending");
              const script = r.active?.scriptURL?.replace(location.origin, "") ?? "?";
              return `[${state}] ${script} (scope: ${scope || "/"})`;
            })
            .join(" | ");
        }
      } catch {
        swStatus = "Error reading registrations";
      }
    }

    // ── OneSignal subscription state ───────────────────────────
    let osState = "Not loaded";
    let permission = "default";
    let optedIn = "unknown";
    let subscriptionId = "N/A";

    try {
      if (Capacitor.isNativePlatform()) {
        const OS = (await import("onesignal-cordova-plugin")).default as any;
        if (OS) {
          osState = "Initialized (Native)";
          subscriptionId = OS.User?.pushSubscription?.id || "None";
          optedIn = String(OS.User?.pushSubscription?.optedIn ?? "unknown");
        }
      } else {
        const OS = typeof window !== "undefined" ? (window as any).OneSignal : null;
        if (OS) {
          osState = "Initialized (Web)";
          permission = Notification.permission;
          optedIn = String(OS.User?.PushSubscription?.optedIn ?? "unknown");
          subscriptionId = OS.User?.PushSubscription?.id || "⚠ Not assigned";
        }
      }
    } catch (e) {
      osState = `Error: ${(e as Error).message}`;
    }

    setData({
      platform: Capacitor.getPlatform(),
      serviceWorkers: swStatus,
      oneSignal: osState,
      permission,
      optedIn,
      subscriptionId,
      lastRefresh: new Date().toLocaleTimeString(),
    });
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!isOpen) return;

    collectData();
    const interval = setInterval(collectData, 5000);
    return () => clearInterval(interval);
  }, [isOpen, collectData]);

  if (process.env.NODE_ENV !== "development") return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 left-4 bg-black/50 text-white text-[10px] px-2 py-1 rounded opacity-50 hover:opacity-100 z-50"
      >
        OS Debug
      </button>
    );
  }

  const subIdFull = data.subscriptionId;
  const subIdShort =
    subIdFull && subIdFull !== "N/A" && subIdFull !== "⚠ Not assigned"
      ? `${subIdFull.slice(0, 8)}…${subIdFull.slice(-6)}`
      : subIdFull;

  const isHealthy =
    data.permission === "granted" && data.optedIn === "true" && !data.subscriptionId.startsWith("⚠");

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-gray-900 text-green-400 font-mono text-[10px] p-3 rounded-lg shadow-xl z-50 overflow-auto max-h-[60vh] border border-gray-700">
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700">
        <h3 className="font-bold text-white">
          OneSignal Diagnostics{" "}
          <span className={isHealthy ? "text-green-400" : "text-yellow-400"}>
            {isHealthy ? "✅" : "⚠️"}
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            onClick={collectData}
            className="text-blue-400 hover:text-blue-200 px-2"
          >
            Refresh
          </button>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white px-2">
            Close
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <div>
          <span className="text-gray-400">Platform:</span>{" "}
          <span className="text-white">{data.platform}</span>
        </div>
        <div>
          <span className="text-gray-400">OneSignal State:</span>{" "}
          <span className="text-white">{data.oneSignal}</span>
        </div>
        <div>
          <span className="text-gray-400">Permission:</span>{" "}
          <span className={data.permission === "granted" ? "text-green-400" : "text-red-400"}>
            {data.permission}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Opted In:</span>{" "}
          <span className={data.optedIn === "true" ? "text-green-400" : "text-yellow-400"}>
            {data.optedIn}
          </span>
        </div>
        <div className="break-all">
          <span className="text-gray-400">Subscription ID:</span>{" "}
          <span
            className={data.subscriptionId.startsWith("⚠") ? "text-yellow-400" : "text-green-400"}
            title={subIdFull}
          >
            {subIdShort}
          </span>
        </div>
        <div className="break-all">
          <span className="text-gray-400">Service Workers:</span>{" "}
          <span className="text-cyan-400">{data.serviceWorkers}</span>
        </div>
        <div className="text-gray-600 pt-1 border-t border-gray-800">
          Last refresh: {data.lastRefresh}
        </div>
      </div>

      {/* Quick copy subscription ID for pasting into OneSignal dashboard */}
      {subIdFull && !subIdFull.startsWith("⚠") && subIdFull !== "N/A" && (
        <button
          onClick={() => navigator.clipboard?.writeText(subIdFull)}
          className="mt-2 w-full text-center text-blue-400 hover:text-blue-200 border border-blue-900 rounded py-1"
        >
          Copy Subscription ID
        </button>
      )}
    </div>
  );
}
