"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type VolunteerEvent } from "@/context/AuthContext";
import { useShakeToScan } from "@/context/ShakeToScanContext";
import LoadingScreen from "@/components/LoadingScreen";
import { Button } from "@/components/Button";
import {
  AlertTriangleIcon,
  CalendarDaysIcon,
  MapPinIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  ZapIcon,
  BellIcon,
  ArrowLeftIcon,
} from "@/components/icons";
import { formatDateShort } from "@/lib/dateUtils";
import { getActiveVolunteerEvents } from "@/lib/volunteerAccess";
import { apiRequest } from "@/lib/apiClient";

/** Returns true when the volunteer assignment expires within 24 hours */
function isExpiringSoon(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() - Date.now() < 24 * 60 * 60 * 1000;
}

function getInitials(name?: string | null): string {
  if (!name) return "V";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function VolunteerDashboardPage() {
  const router = useRouter();
  const { session, userData, isLoading } = useAuth();
  const {
    activeScanEvent,
    shakeEnabled,
    enableForEvent,
    disableShake,
    requestMotionPermission,
    motionSupported,
  } = useShakeToScan();

  const [events, setEvents] = useState<VolunteerEvent[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState<string | null>(null);

  const cachedActiveEvents = useMemo(
    () => getActiveVolunteerEvents(userData?.volunteerEvents),
    [userData?.volunteerEvents]
  );

  const handleToggleShake = async (eventId: string) => {
    setShakeError(null);
    if (shakeEnabled && activeScanEvent === eventId) {
      disableShake();
      return;
    }
    if (!motionSupported) {
      setShakeError("Motion sensors are not available on this device.");
      return;
    }
    const granted = await requestMotionPermission();
    if (!granted) {
      setShakeError("Motion permission is required to use Quick Scan.");
      return;
    }
    enableForEvent(eventId);
  };

  useEffect(() => {
    if (!isLoading && !session) router.replace("/auth");
  }, [isLoading, router, session]);

  const fetchVolunteerEvents = useCallback(async () => {
    if (isLoading || !session?.access_token) return;
    setIsFetching(true);
    setError(null);
    setEvents(cachedActiveEvents);
    try {
      const payload: any = await apiRequest(`/volunteer/events`, { cache: "no-store" });
      setEvents(getActiveVolunteerEvents(payload.events || []));
    } catch (err: any) {
      setEvents([]);
      setError(err.message || "Unable to load your events.");
    } finally {
      setIsFetching(false);
    }
  }, [cachedActiveEvents, isLoading, session]);

  useEffect(() => { fetchVolunteerEvents(); }, [fetchVolunteerEvents]);

  if (isLoading || (isFetching && events.length === 0 && !error)) {
    return <LoadingScreen />;
  }

  /* Guard: Christ University members only */
  if (!isLoading && userData && !userData.register_number) {
    return (
      <div className="pwa-page flex items-center justify-center bg-[var(--color-bg)] px-6">
        <div className="text-center max-w-[300px]">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-[var(--color-primary-light)] flex items-center justify-center">
            <ShieldCheckIcon size={28} className="text-[var(--color-primary)]" />
          </div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Members only</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">
            Only verified university members with a registration ID can volunteer at events.
          </p>
          <button
            onClick={() => router.replace("/")}
            className="btn btn-primary w-full mt-6"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const hasActiveEvents = events.length > 0;
  const isVolunteer = (userData?.volunteerEvents && userData.volunteerEvents.length > 0) || hasActiveEvents;
  const showDenied = error || (!isVolunteer && !isFetching);
  const showNoActive = isVolunteer && !hasActiveEvents && !isFetching && !error;

  const firstName = userData?.name?.split(" ")[0] || "Volunteer";

  return (
    <div className="pwa-page bg-[var(--color-bg)]">

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-20 bg-white border-b border-[var(--color-border)]"
        style={{ paddingTop: "calc(var(--safe-top))" }}
      >
        <div className="flex items-center gap-3 px-4 h-14">
          {/* Avatar */}
          <div className="h-9 w-9 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center shrink-0 overflow-hidden">
            {userData?.avatar_url ? (
              <img src={userData.avatar_url} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[13px] font-bold text-[var(--color-primary)]">
                {getInitials(userData?.name)}
              </span>
            )}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[var(--color-text)] truncate leading-tight">
              {userData?.name || "Volunteer"}
            </p>
          </div>

          {/* Online pill */}
          <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-700">Online</span>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="px-4 pt-5 pb-6 max-w-[480px] mx-auto space-y-5">

        {/* Summary line */}
        {hasActiveEvents && (
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[var(--color-text)]">
              {events.length === 1
                ? "1 event assigned"
                : `${events.length} events assigned`}
            </h2>
            <span className="text-[11px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-1 rounded-full">
              Active
            </span>
          </div>
        )}

        {/* ── Denied / error ── */}
        {showDenied && (
          <div className="card bg-white border border-[var(--color-border)] p-6 text-center">
            <AlertTriangleIcon size={36} className="mx-auto text-[var(--color-danger)] mb-3" />
            <h2 className="text-[15px] font-bold text-[var(--color-text)]">No access</h2>
            <p className="mt-1.5 text-sm text-[var(--color-text-muted)] leading-relaxed">
              {error || "You don't have active volunteer assignments."}
            </p>
            <button onClick={() => router.replace("/")} className="btn btn-ghost w-full mt-5 text-sm">
              Go home
            </button>
          </div>
        )}

        {/* ── No active events ── */}
        {showNoActive && (
          <div className="card bg-white border border-[var(--color-border)] p-6 text-center">
            <div className="h-14 w-14 bg-[var(--color-primary-light)] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CalendarDaysIcon size={26} className="text-[var(--color-primary)]" />
            </div>
            <h2 className="text-[15px] font-bold text-[var(--color-text)]">No events today</h2>
            <p className="mt-1.5 text-sm text-[var(--color-text-muted)] leading-relaxed">
              You don't have any events assigned right now.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button className="btn btn-primary w-full text-sm" onClick={() => fetchVolunteerEvents()}>
                Refresh
              </button>
              <button className="btn btn-ghost w-full text-sm" onClick={() => router.replace("/")}>
                Go home
              </button>
            </div>
          </div>
        )}

        {/* ── Event cards ── */}
        {hasActiveEvents && (
          <div className="space-y-3">
            {events.map((event) => {
              const expiringSoon = isExpiringSoon(event.volunteer_assignment?.expires_at);
              const isQuickScanOn = shakeEnabled && activeScanEvent === event.event_id;

              return (
                <div
                  key={event.event_id}
                  className="card bg-white border border-[var(--color-border)] overflow-hidden"
                >
                  {/* Card body — tappable */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      router.push(`/volunteer/scanner/${encodeURIComponent(event.event_id)}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/volunteer/scanner/${encodeURIComponent(event.event_id)}`);
                      }
                    }}
                    className="w-full text-left p-4 active:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="h-11 w-11 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                        <QrCodeIcon size={20} className="text-white" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[14px] font-bold text-[var(--color-text)] leading-snug">
                            {event.title}
                          </h3>
                          {expiringSoon && (
                            <span className="shrink-0 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                              Ending soon
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                            <CalendarDaysIcon size={11} className="text-[var(--color-primary)]" />
                            {formatDateShort(event.event_date)}
                          </span>
                          {event.venue && (
                            <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] truncate max-w-[160px]">
                              <MapPinIcon size={11} className="text-[var(--color-primary)]" />
                              {event.venue}
                            </span>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-3.5">
                      <div className="btn btn-primary w-full text-sm py-3 pointer-events-none">
                        Start scanning
                      </div>
                    </div>
                  </div>

                  {/* Shake to Scan row */}
                  <div className="px-4 py-3 border-t border-[var(--color-border)] bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ZapIcon
                        size={13}
                        className={isQuickScanOn ? "text-[var(--color-primary)]" : "text-[var(--color-text-light)]"}
                      />
                      <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
                        Shake to Scan {isQuickScanOn ? "(on)" : ""}
                      </span>
                    </div>

                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggleShake(event.event_id);
                      }}
                      className="relative h-6 w-11 rounded-full transition-colors"
                      style={{
                        background: isQuickScanOn
                          ? "var(--color-primary)"
                          : "var(--color-border)",
                      }}
                      aria-label="Toggle Shake to Scan"
                    >
                      <span
                        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                        style={{
                          transform: isQuickScanOn ? "translateX(21px)" : "translateX(2px)",
                        }}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Shake error */}
        {shakeError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-[12px] text-red-700 font-medium">
            <AlertTriangleIcon size={14} className="shrink-0 mt-0.5" />
            <span>{shakeError}</span>
          </div>
        )}

      </div>
    </div>
  );
}
