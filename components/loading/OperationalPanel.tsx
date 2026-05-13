"use client";

import React, { useEffect, useState } from "react";
import { isAndroidNativeBuild } from "@/lib/nativeLaunchState";
import { FossilGlyph } from "./FossilGlyph";
import { stageMessage, TITLES, type OperationKey } from "./loadingStages";
import { useReducedMotion } from "./useReducedMotion";

export interface OperationalPanelProps {
  operation: OperationKey;
  stageIndex?: number;
  message?: string;
  progress?: number;
  blocking?: boolean;
  scannerSafe?: boolean;
  exiting?: boolean;
  done?: boolean;
}

export function OperationalPanel({
  operation,
  stageIndex = 0,
  message,
  progress,
  blocking = true,
  scannerSafe = false,
  exiting = false,
  done = false,
}: OperationalPanelProps) {
  const reduced = useReducedMotion();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(isAndroidNativeBuild());
  }, []);

  const title = TITLES[operation] ?? "Working";
  const resolvedMessage = message ?? stageMessage(operation, stageIndex);
  const indeterminate = typeof progress !== "number";

  const rootClass = [
    "op-root",
    blocking ? "op-root-blocking" : "op-root-passive",
    scannerSafe ? "op-root-scanner-safe" : "",
    isNative ? "op-root-native" : "op-root-web",
    exiting ? "op-root-exiting" : "",
    reduced ? "op-root-reduced" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="status" aria-live="polite">
      {blocking && <div className="op-backdrop" aria-hidden="true" />}
      <div className="op-card">
        <div className="op-card-header">{done ? "Done!" : title}</div>
        <div className="op-card-body">
          <FossilGlyph mode={done ? "done" : "active"} staticOnly={scannerSafe || reduced} />
          <div className="op-progress-track">
            <div
              className={`op-progress-fill${indeterminate ? " op-progress-indeterminate" : ""}`}
              style={indeterminate ? undefined : { width: `${Math.max(4, Math.min(100, progress!))}%` }}
            />
          </div>
          <p className="op-message">{resolvedMessage}</p>
          {blocking && <p className="op-sub">Please don&apos;t close this page</p>}
        </div>
      </div>
    </div>
  );
}
