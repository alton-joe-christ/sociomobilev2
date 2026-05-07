"use client";

import React from "react";

export default function EventCardSkeleton({
  compact,
  featured,
  count = 1,
}: {
  compact?: boolean;
  featured?: boolean;
  count?: number;
}) {
  const Skeletons = Array.from({ length: count }).map((_, i) => (
    <div
      key={i}
      className={`relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)] ${
        compact ? "flex items-center gap-3 p-3" : "block"
      } ${featured ? "card-hero" : ""}`}
    >
      {compact ? (
        <>
          <div className="skeleton h-16 w-16 shrink-0 rounded-[var(--radius-sm)]" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
          <div className="skeleton h-5 w-12 rounded-full" />
        </>
      ) : (
        <>
          {/* Banner area */}
          <div className={`skeleton w-full ${featured ? "aspect-[16/10]" : "aspect-[16/9]"}`} />
          
          {/* Body area */}
          <div className={featured ? "p-5" : "p-4"}>
            <div className="skeleton mb-2 h-3 w-24 rounded" />
            <div className="skeleton mb-3 h-6 w-full rounded" />
            
            <div className="mt-2 flex gap-2">
              <div className="skeleton h-5 w-16 rounded-sm" />
              <div className="skeleton h-5 w-20 rounded-sm" />
            </div>
            
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2">
                <div className="skeleton h-6 w-6 rounded-full" />
                <div className="skeleton h-3 w-20 rounded" />
              </div>
              <div className="skeleton h-8 w-24 rounded-lg" />
            </div>
          </div>
        </>
      )}
    </div>
  ));

  return <>{Skeletons}</>;
}
