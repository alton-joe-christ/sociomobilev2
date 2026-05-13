"use client";

import React from "react";
import { useReducedMotion } from "./useReducedMotion";

export type FossilGlyphMode = "active" | "done";

interface FossilGlyphProps {
  mode?: FossilGlyphMode;
  staticOnly?: boolean;
}

export function FossilGlyph({ mode = "active", staticOnly = false }: FossilGlyphProps) {
  const reduced = useReducedMotion();
  const disableSweep = staticOnly || reduced;

  return (
    <div className="op-glyph" aria-hidden="true">
      <svg viewBox="0 0 168 112" className="op-glyph-svg" preserveAspectRatio="xMidYMid meet">
        <path
          className={`op-glyph-path${mode === "done" ? " op-glyph-path-done" : ""}`}
          d="M22 84 L46 64 L62 70 L70 50 L84 42 L100 50 L108 70 L124 64 L146 84 L120 96 L96 88 L72 88 L48 96 Z"
        />
        {!disableSweep && (
          <line className="op-glyph-sweep" x1="0" y1="22" x2="0" y2="102" />
        )}
      </svg>
    </div>
  );
}
