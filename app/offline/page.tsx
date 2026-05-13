"use client";

import Link from "next/link";
import Image from "next/image";
import { WifiOffIcon, CompassIcon, CalendarDaysIcon, UserIcon } from "@/components/icons";

export default function OfflinePage() {
  return (
    <div className="pwa-page-center px-6">
      <Image src="/logo.svg" alt="Socio" width={110} height={35} className="mb-8 opacity-80" />
      
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-slate-100 animate-pulse scale-150 opacity-50" />
        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center relative z-10">
          <WifiOffIcon size={40} className="text-slate-400" />
        </div>
      </div>

      <h1 className="text-[22px] font-extrabold text-[var(--color-text)] mb-2 tracking-tight">Offline Mode</h1>
      <p className="text-[14px] font-medium text-[var(--color-text-muted)] max-w-[260px] mb-8 leading-relaxed">
        Some content is unavailable right now. Reconnect to continue browsing live events.
      </p>

      <div className="w-full max-w-[280px] bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left mb-8">
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Available Offline</h2>
        <ul className="flex flex-col gap-3">
          <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CompassIcon size={16} />
            </div>
            Cached Discover Feed
          </li>
          <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <CalendarDaysIcon size={16} />
            </div>
            Cached Events & Fests
          </li>
          <li className="flex items-center gap-3 text-sm font-semibold text-gray-700">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserIcon size={16} />
            </div>
            Your Profile
          </li>
        </ul>
      </div>

      <button 
        onClick={() => window.location.reload()} 
        className="btn bg-[var(--color-primary)] text-white text-[15px] font-bold px-8 py-3 rounded-xl shadow-md active:scale-95 transition-transform"
      >
        Retry Connection
      </button>
      
      <Link href="/" className="mt-4 text-sm font-semibold text-gray-500 active:text-gray-800 transition-colors">
        Go to Home
      </Link>
    </div>
  );
}
