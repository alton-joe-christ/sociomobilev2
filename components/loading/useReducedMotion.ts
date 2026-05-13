"use client";

import { useEffect, useState } from "react";
import { isReducedSensoryMode } from "@/lib/nativeLaunchState";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return isReducedSensoryMode();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mql) return;
    const handler = () => setReduced(isReducedSensoryMode());
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  return reduced;
}
