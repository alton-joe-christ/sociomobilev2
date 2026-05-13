import React from "react";
import { BlueprintFossilLoader } from "@/components/loading";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[40] bg-white">
      <BlueprintFossilLoader variant="panel" operation="cache.restore" blocking={false} />
    </div>
  );
}
