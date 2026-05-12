type PerfPayload = Record<string, unknown> | undefined;

const lastEventAt = new Map<string, number>();

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function readLocalFlag(): boolean {
  if (!canUseWindow()) return false;
  try {
    return window.localStorage.getItem("socio_capacitor_perf_audit") === "1";
  } catch {
    return false;
  }
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export function isCapacitorPerfAuditEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || readLocalFlag();
}

export function logCapacitorPerfAudit(event: string, payload?: PerfPayload): void {
  if (!isCapacitorPerfAuditEnabled()) return;
  if (payload) {
    console.log(`[CapacitorPerfAudit] ${event}`, payload);
  } else {
    console.log(`[CapacitorPerfAudit] ${event}`);
  }
}

export function logCapacitorPerfAuditThrottled(
  event: string,
  minIntervalMs: number,
  payload?: PerfPayload
): void {
  const now = Date.now();
  const last = lastEventAt.get(event) ?? 0;
  if (now - last < minIntervalMs) return;
  lastEventAt.set(event, now);
  logCapacitorPerfAudit(event, payload);
}

export function startPerfSpan(name: string, payload?: PerfPayload): (extra?: PerfPayload) => void {
  const startedAt = nowMs();
  if (payload) {
    logCapacitorPerfAudit(`${name}:start`, payload);
  } else {
    logCapacitorPerfAudit(`${name}:start`);
  }

  return (extra?: PerfPayload) => {
    const durationMs = Math.round((nowMs() - startedAt) * 100) / 100;
    logCapacitorPerfAudit(`${name}:end`, { durationMs, ...(extra || {}) });
  };
}

export async function withPerfSpan<T>(
  name: string,
  fn: () => Promise<T>,
  payload?: PerfPayload
): Promise<T> {
  const end = startPerfSpan(name, payload);
  try {
    const result = await fn();
    end({ status: "ok" });
    return result;
  } catch (error) {
    end({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function startFrameMonitor(label: string, durationMs = 1200): () => void {
  if (!canUseWindow() || typeof window.requestAnimationFrame !== "function") {
    return () => {};
  }
  if (!isCapacitorPerfAuditEnabled()) {
    return () => {};
  }

  const startedAt = nowMs();
  let frames = 0;
  let active = true;
  let rafId = 0;

  const tick = () => {
    if (!active) return;
    frames += 1;
    const elapsed = nowMs() - startedAt;
    if (elapsed >= durationMs) {
      const fps = Math.round((frames / (elapsed / 1000)) * 10) / 10;
      logCapacitorPerfAudit("frame-monitor", {
        label,
        durationMs: Math.round(elapsed),
        frames,
        fps,
      });
      active = false;
      return;
    }
    rafId = window.requestAnimationFrame(tick);
  };

  rafId = window.requestAnimationFrame(tick);
  return () => {
    active = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
  };
}

export function logMemorySnapshot(label: string): void {
  if (!canUseWindow() || !isCapacitorPerfAuditEnabled()) return;
  const perfLike = performance as Performance & {
    memory?: {
      usedJSHeapSize: number;
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
    };
  };

  if (!perfLike.memory) return;
  const usedMB = Math.round((perfLike.memory.usedJSHeapSize / (1024 * 1024)) * 100) / 100;
  const totalMB = Math.round((perfLike.memory.totalJSHeapSize / (1024 * 1024)) * 100) / 100;
  const limitMB = Math.round((perfLike.memory.jsHeapSizeLimit / (1024 * 1024)) * 100) / 100;
  logCapacitorPerfAudit("memory", { label, usedMB, totalMB, limitMB });
}
