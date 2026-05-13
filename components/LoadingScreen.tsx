import React from "react";
import { OperationalPanel } from "@/components/loading";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[40] bg-white">
      <OperationalPanel operation="cache.restore" blocking={false} progress={undefined} />
    </div>
  );
}
