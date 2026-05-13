"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { isAndroidNativeBuild } from "@/lib/nativeLaunchState";
import { FossilGlyph } from "./FossilGlyph";
import { TITLES, stageMessage, type OperationKey } from "./loadingStages";
import { useReducedMotion } from "./useReducedMotion";

export type BlueprintFossilVariant = "panel" | "recovery" | "compact" | "first-launch";

export interface BlueprintFossilLoaderProps {
  variant?: BlueprintFossilVariant;
  title?: string;
  message?: string;
  subMessage?: string;
  progress?: number;
  indeterminate?: boolean;
  blocking?: boolean;
  scannerSafe?: boolean;
  operation?: OperationKey;
  stageIndex?: number;
  done?: boolean;
  exiting?: boolean;
}

const CARD_TRANSITION = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };
const MESSAGE_TRANSITION = { duration: 0.18 };

export function BlueprintFossilLoader({
  variant = "panel",
  title,
  message,
  subMessage,
  progress,
  indeterminate,
  blocking,
  scannerSafe = false,
  operation,
  stageIndex = 0,
  done = false,
  exiting = false,
}: BlueprintFossilLoaderProps) {
  const reduced = useReducedMotion();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(isAndroidNativeBuild());
  }, []);

  const isRecovery = variant === "recovery";
  const isFirstLaunch = variant === "first-launch";
  const isCompact = variant === "compact";

  // Recovery is passive by default; everything else can be blocking unless explicitly opted out.
  const resolvedBlocking = blocking ?? (isRecovery ? false : true);

  // Recovery defaults to indeterminate; explicit prop or progress wins.
  const resolvedIndeterminate =
    indeterminate ?? (typeof progress !== "number" || (isRecovery && progress == null));

  const resolvedTitle =
    title ?? (operation ? TITLES[operation] ?? "Working" : "Working");
  const resolvedMessage =
    message ?? (operation ? stageMessage(operation, stageIndex) : "");
  const resolvedSubMessage =
    subMessage ?? (resolvedBlocking && !isRecovery && !isCompact
      ? "Please don't close this page"
      : undefined);

  const rootClass = [
    isRecovery ? "op-recovery-root" : "op-root",
    resolvedBlocking ? "op-root-blocking" : "op-root-passive",
    isFirstLaunch ? "op-root-first-launch" : "",
    scannerSafe ? "op-root-scanner-safe" : "",
    isNative ? "op-root-native" : "op-root-web",
    exiting ? "op-root-exiting" : "",
    reduced ? "op-root-reduced" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardClass = [
    "op-card",
    isRecovery ? "op-card-recovery" : "",
    isCompact ? "op-card-compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const headerLabel = done && !isRecovery ? "Done!" : resolvedTitle;
  const showProgressLabel = !resolvedIndeterminate && typeof progress === "number" && !isRecovery;

  return (
    <div className={rootClass} role="status" aria-live="polite">
      {resolvedBlocking && (
        <div
          className={`op-backdrop${isFirstLaunch ? " op-backdrop-first-launch" : ""}`}
          aria-hidden="true"
        />
      )}
      <motion.div
        className={cardClass}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 0 }}
        transition={CARD_TRANSITION}
      >
        <div className="op-card-header">
          {isRecovery && <span className="op-recovery-dot" aria-hidden="true" />}
          <span>{headerLabel}</span>
        </div>
        <div className="op-card-body">
          <FossilGlyph mode={done ? "done" : "active"} scannerSafe={scannerSafe} />

          <div className="op-progress-row">
            <div className="op-progress-track">
              <div
                className={`op-progress-fill${resolvedIndeterminate ? " op-progress-indeterminate" : ""}`}
                style={
                  resolvedIndeterminate
                    ? undefined
                    : { width: `${Math.max(4, Math.min(100, progress!))}%` }
                }
              />
            </div>
            {showProgressLabel && (
              <span className="op-progress-label">{Math.round(progress!)}%</span>
            )}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={resolvedMessage}
              className="op-message"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={MESSAGE_TRANSITION}
            >
              {resolvedMessage}
            </motion.p>
          </AnimatePresence>

          {resolvedSubMessage && <p className="op-sub">{resolvedSubMessage}</p>}
        </div>
      </motion.div>
    </div>
  );
}
