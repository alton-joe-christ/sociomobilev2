"use client";

import React, { useEffect, useState } from "react";
import { isAndroidNativeBuild } from "@/lib/nativeLaunchState";
import { FossilGlyph } from "./FossilGlyph";
import { TITLES, stageMessage, type OperationKey } from "./loadingStages";
import { useReducedMotion } from "./useReducedMotion";

export interface RecoveryCardProps {
  operation: OperationKey;
  stageIndex?: number;
  message?: string;
  scannerSafe?: boolean;
  exiting?: boolean;
}

export function RecoveryCard({
  operation,
  stageIndex = 0,
  message,
  scannerSafe = false,
  exiting = false,
}: RecoveryCardProps) {
  const reduced = useReducedMotion();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(isAndroidNativeBuild());
  }, []);

  const title = TITLES[operation] ?? "Reconnecting";
  const resolvedMessage = message ?? stageMessage(operation, stageIndex);

  const rootClass = [
    "op-recovery-root",
    scannerSafe ? "op-root-scanner-safe" : "",
    isNative ? "op-root-native" : "op-root-web",
    exiting ? "op-root-exiting" : "",
    reduced ? "op-root-reduced" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <div className="op-card op-card-recovery">
        <div className="op-card-header">
          <span className="op-recovery-dot" aria-hidden="true" />
          <span>{title}</span>
        </div>
        <div className="op-card-body">
          <FossilGlyph mode="active" staticOnly={reduced} />
          <p className="op-message">{resolvedMessage}</p>
        </div>
      </div>
    </div>
  );
}
