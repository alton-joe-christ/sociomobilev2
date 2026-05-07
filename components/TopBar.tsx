"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import { ArrowLeftIcon, UserIcon } from "@/components/icons";

// Pages that show back button instead of logo
const BACK_PAGES = ["/event/", "/fest/", "/notifications", "/club/"];

export default function TopBar() {
  const { userData } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const showBack = BACK_PAGES.some((p) => pathname.startsWith(p));
  const isProfile = pathname === "/profile";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 will-change-none transition-colors duration-200 ${
        isProfile && userData
          ? "bg-[var(--color-primary-dark)] text-white"
          : "glass border-b border-[var(--color-border)] text-[var(--color-text)]"
      } ${showBack ? "border-none shadow-none" : ""}`}
      style={{ paddingTop: "var(--safe-top)", backfaceVisibility: "hidden" }}
    >
      <div
        className="relative flex items-center px-4 gap-2 will-change-none"
        style={{ height: "var(--nav-height)" }}
      >
        {/* Left: Back button or profile/avatar */}
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="back-btn"
            aria-label="Go back"
          >
            <ArrowLeftIcon size={18} strokeWidth={2.2} />
          </button>
        ) : userData ? (
          <Link href="/profile" className="shrink-0">
            <div className="w-[34px] h-[34px] rounded-full overflow-hidden ring-2 ring-[#1a3a7a] shadow-[0_4px_14px_rgba(0,0,0,0.3)] bg-white/10 flex items-center justify-center">
              {userData.avatar_url ? (
                <Image
                  src={userData.avatar_url}
                  alt={userData.name || "User"}
                  width={34}
                  height={34}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[13px] font-black text-white drop-shadow-sm">
                  {userData.name?.[0]?.toUpperCase() || "U"}
                </span>
              )}
            </div>
          </Link>
        ) : (
          <Link href="/auth" className="flex items-center justify-center shrink-0 text-[var(--color-text-muted)] p-1">
            <UserIcon size={24} strokeWidth={1.5} />
          </Link>
        )}

        {!showBack && (
          <Link
            href="/"
            className={`absolute left-1/2 -translate-x-1/2 text-[17px] font-black tracking-tight ${
              isProfile ? "text-white" : "text-[var(--color-primary)]"
            }`}
            aria-label="Go to home"
          >
            SOCIO
          </Link>
        )}

        <div className="flex-1" />

        {/* Right actions */}
        {userData ? (
          <NotificationBell />
        ) : (
          <Link
            href="/auth"
            className="btn btn-primary btn-topbar-auth font-extrabold shadow-sm"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
