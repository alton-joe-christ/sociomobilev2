"use client";

import React from "react";

interface MicroLoaderProps {
  size?: "sm" | "md" | "lg" | number;
  className?: string;
  ariaLabel?: string;
  tone?: "current" | "primary";
}

export function MicroLoader({ size = "sm", className = "", ariaLabel, tone = "current" }: MicroLoaderProps) {
  const dimensionClass =
    typeof size === "number"
      ? ""
      : size === "lg"
        ? "h-9 w-9 border-[3px]"
        : size === "md"
          ? "h-4 w-4"
          : "h-3.5 w-3.5";
  const style =
    typeof size === "number"
      ? { width: size, height: size, borderWidth: Math.max(2, Math.round(size / 12)) }
      : undefined;
  const toneClass = tone === "primary" ? "text-[var(--color-primary)]" : "";
  return (
    <span
      role={ariaLabel ? "status" : undefined}
      aria-label={ariaLabel}
      style={style}
      className={`inline-block ${dimensionClass} ${toneClass} animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
