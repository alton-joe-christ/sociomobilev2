"use client";

import React from "react";
import { FossilGlyph } from "./FossilGlyph";
import { stageMessage, TITLES } from "./loadingStages";
import { useReducedMotion } from "./useReducedMotion";

export interface FirstLaunchPanelProps {
  stageIndex: number;
  progress: number;
  message?: string;
  exiting?: boolean;
  done?: boolean;
}

export function FirstLaunchPanel({
  stageIndex,
  progress,
  message,
  exiting = false,
  done = false,
}: FirstLaunchPanelProps) {
  const reduced = useReducedMotion();
  const resolvedMessage = message ?? stageMessage("launch.first", stageIndex);

  const rootClass = [
    "op-root",
    "op-root-blocking",
    "op-root-first-launch",
    "op-root-native",
    exiting ? "op-root-exiting" : "",
    reduced ? "op-root-reduced" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <div className="op-backdrop op-backdrop-first-launch" aria-hidden="true" />
      <div className="op-card">
        <div className="op-card-header">{done ? "Ready!" : TITLES["launch.first"]}</div>
        <div className="op-card-body">
          <FossilGlyph mode={done ? "done" : "active"} staticOnly={reduced} />
          <div className="op-progress-track">
            <div
              className="op-progress-fill"
              style={{ width: `${Math.max(6, Math.min(100, progress))}%` }}
            />
          </div>
          <p className="op-message">{resolvedMessage}</p>
          <p className="op-sub">Setting up your campus terminal</p>
        </div>
      </div>
    </div>
  );
}
