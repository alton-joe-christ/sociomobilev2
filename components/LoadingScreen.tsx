import Image from "next/image";
import React from "react";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white gap-4">
      <div className="flex items-center justify-center">
        <Image
          src="/logo.svg"
          alt="SOCIO is loading"
          width={80}
          height={80}
          className="animate-pulse"
        />
      </div>
      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#063168]/80">
        Loading SOCIO
      </p>
    </div>
  );
}
