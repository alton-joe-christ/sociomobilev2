"use client";

import React from "react";

export default function FestCardSkeleton({
  count = 1,
}: {
  count?: number;
}) {
  const Skeletons = Array.from({ length: count }).map((_, i) => (
    <div
      key={i}
      className="card-elevated relative block h-[220px] w-full overflow-hidden border border-[var(--color-border)] bg-white"
    >
      <div className="skeleton h-full w-full" />
      
      <div className="absolute inset-0 p-5 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="skeleton h-6 w-24 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
        
        <div>
          <div className="skeleton mb-2 h-3 w-32 rounded" />
          <div className="skeleton mb-2 h-7 w-48 rounded" />
          <div className="skeleton h-3 w-40 rounded" />
        </div>
      </div>
    </div>
  ));

  return <>{Skeletons}</>;
}
