"use client";

import React from "react";

export type FossilGlyphMode = "active" | "done";

interface FossilGlyphProps {
  mode?: FossilGlyphMode;
  scannerSafe?: boolean;
}

interface BoneSpec {
  d: string;
  len: number;
  delay: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

const BONES: BoneSpec[] = [
  // Spine (skull base → tail tip)
  {
    d: "M88 110 C 130 96, 178 90, 220 96 C 252 100, 280 112, 296 124 L 312 132",
    len: 260,
    delay: 0,
  },
  // Skull + jaw
  {
    d: "M70 116 L 60 104 L 78 96 L 90 102 L 96 110 L 86 116 Z M 78 116 L 84 122 L 92 120",
    len: 110,
    delay: 0,
  },
  // Tail taper
  {
    d: "M 296 124 C 314 128, 326 132, 338 140",
    len: 70,
    delay: 1,
  },
  // Front leg
  {
    d: "M 138 108 L 142 142 L 134 168 L 138 174 L 152 174",
    len: 110,
    delay: 4,
  },
  // Rear leg
  {
    d: "M 244 108 L 250 146 L 240 174 L 244 180 L 262 180",
    len: 120,
    delay: 5,
  },
  // Ribs (single combined path)
  {
    d: "M 152 102 C 156 122, 158 134, 156 150 M 178 96 C 182 118, 184 132, 182 152 M 204 94 C 208 118, 210 132, 208 152",
    len: 220,
    delay: 3,
  },
  // Sail spines (combined)
  {
    d: "M 132 100 L 130 76 M 150 94 L 148 62 M 168 88 L 166 48 M 188 84 L 188 38 M 208 84 L 210 46 M 226 88 L 230 60 M 246 96 L 250 76",
    len: 240,
    delay: 2,
  },
  // Belly line
  {
    d: "M 138 152 C 170 158, 220 158, 252 150",
    len: 130,
    delay: 6,
  },
];

const PARTICLES: { cx: number; cy: number; r: number; delay: 1 | 2 | 3 | 4 | 5 | 6 }[] = [
  { cx: 34, cy: 28, r: 1.6, delay: 1 },
  { cx: 308, cy: 38, r: 1.8, delay: 2 },
  { cx: 56, cy: 168, r: 1.4, delay: 3 },
  { cx: 300, cy: 168, r: 1.6, delay: 4 },
  { cx: 180, cy: 22, r: 1.2, delay: 5 },
  { cx: 26, cy: 96, r: 1.2, delay: 6 },
];

export function FossilGlyph({ mode = "active", scannerSafe = false }: FossilGlyphProps) {
  return (
    <div className="bp-glyph" aria-hidden="true">
      <svg
        viewBox="0 0 360 200"
        className="bp-glyph-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="bp-dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" className="bp-grid-bg" />
          </pattern>
          <radialGradient id="bp-glow-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22B8FF" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#22B8FF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#22B8FF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bp-sweep-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22B8FF" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#22B8FF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Grid background */}
        <rect x="0" y="0" width="360" height="200" fill="url(#bp-dot-grid)" />

        {/* Soft cyan underglow */}
        <ellipse
          className="bp-glow"
          cx="180"
          cy="120"
          rx="150"
          ry="34"
          fill="url(#bp-glow-gradient)"
        />

        {/* Skeleton bones */}
        <g className="bp-skeleton">
          {BONES.map((bone, idx) => (
            <path
              key={idx}
              className={`bp-bone bp-bone-d${bone.delay}`}
              d={bone.d}
              style={{ ["--bp-bone-len" as never]: bone.len } as React.CSSProperties}
            />
          ))}
          {/* Eye */}
          <circle className="bp-eye" cx="74" cy="108" r="1.6" />
          {/* Front knee + rear knee joints */}
          <circle className="bp-joint" cx="142" cy="142" r="1.4" />
          <circle className="bp-joint" cx="250" cy="146" r="1.4" />
        </g>

        {/* Floating blueprint particles */}
        <g>
          {PARTICLES.map((p, idx) => (
            <circle
              key={idx}
              className={`bp-particle bp-particle-d${p.delay}`}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
            />
          ))}
        </g>

        {/* Horizontal scan sweep + glowing dot */}
        <g className="bp-sweep-group">
          <line className="bp-sweep-line" x1="0" y1="120" x2="360" y2="120" />
          <circle className="bp-sweep-halo" cx="360" cy="120" r="9" fill="url(#bp-sweep-halo)" />
          <circle className="bp-sweep-dot" cx="360" cy="120" r="3.5" />
        </g>

        {/* Success accent (kept subtle) */}
        {mode === "done" && (
          <circle cx="180" cy="120" r="22" fill="none" stroke="#10B981" strokeWidth="1.4" />
        )}

        {/* Scanner-safe hint (hidden visually; class on root handles motion gates) */}
        {scannerSafe && <desc>scanner-safe</desc>}
      </svg>
    </div>
  );
}
