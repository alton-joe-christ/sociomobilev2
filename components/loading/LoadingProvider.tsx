"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { OperationalPanel } from "./OperationalPanel";
import { RecoveryCard } from "./RecoveryCard";
import { useDelayedShow } from "./useDelayedShow";
import type { OperationKey } from "./loadingStages";

export type LoaderKind = "panel" | "recovery";

export interface LoaderRequest {
  id: string;
  kind: LoaderKind;
  operation: OperationKey;
  blocking?: boolean;
  stageIndex?: number;
  message?: string;
  progress?: number;
  minVisibleMs?: number;
  scannerSafe?: boolean;
  routeScope?: string;
}

interface ActiveEntry extends LoaderRequest {
  startedAt: number;
  shownAt: number | null;
  done: boolean;
}

interface LoadingApi {
  show: (req: LoaderRequest) => LoaderHandle;
  update: (id: string, patch: Partial<LoaderRequest>) => void;
  hide: (id: string) => void;
}

export interface LoaderHandle {
  id: string;
  update: (patch: Partial<LoaderRequest>) => void;
  done: () => void;
}

const LoadingContext = createContext<LoadingApi | null>(null);

const MIN_VISIBLE_DEFAULT = 340;
const REMOVE_FADE_MS = 240;

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ActiveEntry[]>([]);
  const entriesRef = useRef<ActiveEntry[]>([]);
  const removalTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pathname = usePathname();

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    return () => {
      const timers = removalTimersRef.current;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.blocking || !e.routeScope || e.routeScope === pathname);
      return next.length === prev.length ? prev : next;
    });
  }, [pathname]);

  const removeNow = useCallback((id: string) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next.splice(idx, 1);
      return next;
    });
    const timer = removalTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      removalTimersRef.current.delete(id);
    }
  }, []);

  const show = useCallback((req: LoaderRequest): LoaderHandle => {
    const startedAt = performance.now();
    setEntries((prev) => {
      if (prev.some((e) => e.id === req.id)) return prev;
      const entry: ActiveEntry = {
        ...req,
        startedAt,
        shownAt: null,
        done: false,
      };
      return [...prev, entry];
    });
    return {
      id: req.id,
      update: (patch) => {
        setEntries((prev) => prev.map((e) => (e.id === req.id ? { ...e, ...patch } : e)));
      },
      done: () => {
        const entry = entriesRef.current.find((e) => e.id === req.id);
        if (!entry) return;
        const now = performance.now();
        const visibleSince = entry.shownAt ?? now;
        const minVisible = entry.minVisibleMs ?? MIN_VISIBLE_DEFAULT;
        const remaining = entry.shownAt ? Math.max(0, minVisible - (now - visibleSince)) : 0;
        if (remaining === 0) {
          removeNow(req.id);
        } else {
          const existing = removalTimersRef.current.get(req.id);
          if (existing) clearTimeout(existing);
          const t = setTimeout(() => removeNow(req.id), remaining);
          removalTimersRef.current.set(req.id, t);
        }
      },
    };
  }, [removeNow]);

  const update = useCallback((id: string, patch: Partial<LoaderRequest>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const hide = useCallback((id: string) => {
    removeNow(id);
  }, [removeNow]);

  const api = useMemo<LoadingApi>(() => ({ show, update, hide }), [show, update, hide]);

  const primary = useMemo<ActiveEntry | null>(() => {
    const blocking = entries.find((e) => e.kind === "panel" && e.blocking);
    if (blocking) return blocking;
    const passive = entries.find((e) => e.kind === "panel" && !e.blocking);
    if (passive) return passive;
    return entries.find((e) => e.kind === "recovery") ?? null;
  }, [entries]);

  return (
    <LoadingContext.Provider value={api}>
      {children}
      <LoadingHost entry={primary} onShown={(id, at) => {
        setEntries((prev) => prev.map((e) => (e.id === id && e.shownAt === null ? { ...e, shownAt: at } : e)));
      }} />
    </LoadingContext.Provider>
  );
}

function LoadingHost({ entry, onShown }: { entry: ActiveEntry | null; onShown: (id: string, at: number) => void }) {
  const active = !!entry;
  const { showPanel } = useDelayedShow(active);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!entry) {
      lastIdRef.current = null;
      return;
    }
    if (showPanel && lastIdRef.current !== entry.id) {
      lastIdRef.current = entry.id;
      onShown(entry.id, performance.now());
    }
  }, [entry, showPanel, onShown]);

  if (!entry || !showPanel) return null;

  if (entry.kind === "recovery") {
    return (
      <RecoveryCard
        operation={entry.operation}
        stageIndex={entry.stageIndex}
        message={entry.message}
        scannerSafe={entry.scannerSafe}
      />
    );
  }

  return (
    <OperationalPanel
      operation={entry.operation}
      stageIndex={entry.stageIndex}
      message={entry.message}
      progress={entry.progress}
      blocking={entry.blocking}
      scannerSafe={entry.scannerSafe}
    />
  );
}

export function useLoading(): LoadingApi {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    return {
      show: () => ({ id: "noop", update: () => {}, done: () => {} }),
      update: () => {},
      hide: () => {},
    };
  }
  return ctx;
}

export const __REMOVE_FADE_MS = REMOVE_FADE_MS;
