"use client";

import { useEffect, useRef, useState } from "react";

export interface DelayedShowOptions {
  skeletonAt?: number;
  panelAt?: number;
  detailedAt?: number;
}

export interface DelayedShowState {
  showSkeleton: boolean;
  showPanel: boolean;
  showDetailed: boolean;
}

const DEFAULT_SKELETON_MS = 150;
const DEFAULT_PANEL_MS = 500;
const DEFAULT_DETAILED_MS = 1200;

export function useDelayedShow(active: boolean, opts: DelayedShowOptions = {}): DelayedShowState {
  const skeletonMs = opts.skeletonAt ?? DEFAULT_SKELETON_MS;
  const panelMs = opts.panelAt ?? DEFAULT_PANEL_MS;
  const detailedMs = opts.detailedAt ?? DEFAULT_DETAILED_MS;

  const [state, setState] = useState<DelayedShowState>({
    showSkeleton: false,
    showPanel: false,
    showDetailed: false,
  });

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    while (timers.length) {
      const t = timers.pop();
      if (t) clearTimeout(t);
    }

    if (!active) {
      setState({ showSkeleton: false, showPanel: false, showDetailed: false });
      return;
    }

    timers.push(setTimeout(() => setState((s) => (s.showSkeleton ? s : { ...s, showSkeleton: true })), skeletonMs));
    timers.push(setTimeout(() => setState((s) => (s.showPanel ? s : { ...s, showPanel: true })), panelMs));
    timers.push(setTimeout(() => setState((s) => (s.showDetailed ? s : { ...s, showDetailed: true })), detailedMs));

    return () => {
      while (timers.length) {
        const t = timers.pop();
        if (t) clearTimeout(t);
      }
    };
  }, [active, skeletonMs, panelMs, detailedMs]);

  return state;
}
