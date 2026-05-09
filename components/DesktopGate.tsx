"use client";

import { usePathname } from "next/navigation";
import { MonitorIcon, ArrowRightIcon, SmartphoneIcon } from "@/components/icons";

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || "https://socio.christuniversity.in";

/**
 * Full-screen overlay shown on viewports ≥ 768 px.
 * CSS in globals.css hides everything behind it automatically.
 * Redirects desktop users back to the main web app, preserving the current path.
 */
export default function DesktopGate() {
  const pathname = usePathname();
  const webUrl = `${WEB_URL}${pathname}`;

  return (
    <div className="desktop-gate" aria-label="Desktop redirect notice">
      <div className="animate-bounce-in">
        <MonitorIcon size={64} strokeWidth={1.4} />
      </div>

      <h1 className="text-2xl font-extrabold leading-tight animate-fade-up">
        Best on Mobile
      </h1>
      <p className="text-sm opacity-80 max-w-xs animate-fade-up" style={{ animationDelay: "80ms" }}>
        This app is designed as a mobile-first experience.
        <br />
        For the full desktop site, visit:
      </p>

      <a
        href={webUrl}
        className="btn btn-accent mt-2 animate-fade-up"
        style={{ animationDelay: "160ms" }}
      >
        Open on Desktop <ArrowRightIcon size={16} />
      </a>

      <div
        className="flex items-center gap-2 text-xs opacity-60 mt-8 animate-fade-in"
        style={{ animationDelay: "300ms" }}
      >
        <SmartphoneIcon size={14} /> Open on your phone for the best experience
      </div>
    </div>
  );
}
