"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, type VolunteerEvent } from "@/context/AuthContext";
import { useShakeToScan } from "@/context/ShakeToScanContext";
import LoadingScreen from "@/components/LoadingScreen";
import { Button } from "@/components/Button";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  Clock3Icon,
  MapPinIcon,
  QrCodeIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { formatDateShort, formatTime } from "@/lib/dateUtils";
import { getActiveVolunteerEvents } from "@/lib/volunteerAccess";
import { PWA_API_URL } from "@/lib/apiConfig";

const DENIED_MESSAGE = "You do not have permission to access this feature";

/** Returns true when the volunteer assignment expires within 24 hours */
function isExpiringSoon(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() - Date.now() < 24 * 60 * 60 * 1000;
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
    motionPermission,
  } = useShakeToScan();
  const [events, setEvents] = useState<VolunteerEvent[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState<string | null>(null);

  const cachedActiveEvents = useMemo(
    () => getActiveVolunteerEvents(userData?.volunteerEvents),
    [userData?.volunteerEvents]
  );

  const activeShakeEvent = useMemo(() => {
    const source = events.length > 0 ? events : cachedActiveEvents;
    return source.find((item) => item.event_id === activeScanEvent) || null;
  }, [activeScanEvent, cachedActiveEvents, events]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/auth");
    }
  }, [isLoading, router, session]);

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
      setShakeError("Motion permission is required to enable shake to scan.");
      return;
    }

    enableForEvent(eventId);
  };

  const fetchVolunteerEvents = useCallback(async () => {
    if (isLoading || !session?.access_token) return;

    setIsFetching(true);
    setError(null);
    setEvents(cachedActiveEvents);

    try {
      const res = await fetch(`${PWA_API_URL}/volunteer/events`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEvents([]);
        if (res.status >= 500) {
          setError("The server took too long to respond. Please try again later.");
        } else {
          setError(payload.error || DENIED_MESSAGE);
        }
        return;
      }

      const nextEvents = getActiveVolunteerEvents(payload.events || []);
      setEvents(nextEvents);
    } catch {
      setEvents([]);
      setError("Unable to load volunteer assignments.");
    } finally {
      setIsFetching(false);
    }
  }, [cachedActiveEvents, isLoading, session]);

  useEffect(() => {
    fetchVolunteerEvents();
  }, [fetchVolunteerEvents]);

  if (isLoading || (isFetching && events.length === 0 && !error)) {
    return <LoadingScreen />;
  }

  // Guard: volunteers must have a register number (Christ University members only)
  if (!isLoading && userData && !userData.register_number) {
    return (
      <div className="pwa-page min-h-screen px-4 pb-[calc(var(--bottom-nav)+var(--safe-bottom)+96px)] pt-[calc(var(--nav-height)+var(--safe-top)+16px)]">
        <div className="mx-auto max-w-[420px]">
          <section className="card p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <ShieldCheckIcon size={22} />
            </div>
            <h1 className="text-[17px] font-extrabold text-[var(--color-text)]">
              Volunteer access requires a Christ University account
            </h1>
            <p className="mx-auto mt-2 max-w-[280px] text-[13px] leading-5 text-[var(--color-text-muted)]">
              Only registered Christ University students with a valid register number can be assigned as volunteers.
            </p>
            <Button variant="primary" className="mt-5" onClick={() => router.replace("/")}>
              Back Home
            </Button>
          </section>
        </div>
      </div>
    );
  }

  const isVolunteer = (userData?.volunteerEvents && userData.volunteerEvents.length > 0) || events.length > 0;
  const hasActiveEvents = events.length > 0;
  const showDenied = error || (!isVolunteer && !isFetching);
  const showNoActive = isVolunteer && !hasActiveEvents && !isFetching && !error;

  return (
    <div className="pwa-page min-h-screen px-4 pb-[calc(var(--bottom-nav)+var(--safe-bottom)+96px)] pt-[calc(var(--nav-height)+var(--safe-top)+16px)]">
      <div className="mx-auto max-w-[420px] space-y-5">
        {/* Header */}
        <section className="rounded-[26px] bg-[var(--color-primary-dark)] px-5 py-6 text-white shadow-[0_12px_32px_rgba(1,31,123,0.18)]">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12">
              <QrCodeIcon size={24} />
            </div>
            <div>
              <h1 className="text-[22px] font-black tracking-[-0.02em]">Volunteer Dashboard</h1>
              <p className="mt-1 text-[12px] leading-5 text-blue-100">
                Assigned event scanners only. Access closes when the event ends.
              </p>
            </div>
          </div>
        </section>

        {showDenied ? (
          <section className="card p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangleIcon size={22} />
            </div>
            <h2 className="text-[16px] font-extrabold text-[var(--color-text)]">Access denied</h2>
            <p className="mx-auto mt-2 max-w-[280px] text-[13px] leading-5 text-[var(--color-text-muted)]">
              {error || DENIED_MESSAGE}
            </p>
            <Button variant="primary" className="mt-4" onClick={() => router.replace("/")}>
              Back Home
            </Button>
          </section>
        ) : showNoActive ? (
          <section className="card p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <CalendarDaysIcon size={24} />
            </div>
            <h2 className="text-[16px] font-extrabold text-[var(--color-text)]">No active assignments</h2>
            <p className="mx-auto mt-2 max-w-[280px] text-[13px] leading-5 text-[var(--color-text-muted)]">
              You are registered as a volunteer, but you have no active event assignments at the moment.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="primary" onClick={() => fetchVolunteerEvents()}>
                Refresh Assignments
              </Button>
              <Button variant="ghost" onClick={() => router.replace("/")}>
                Back Home
              </Button>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[16px] font-extrabold text-[var(--color-text)]">Assigned Events</h2>
              <span className="rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)]">
                {events.length}
              </span>
            </div>

            {/* Shake-to-scan widget */}
            <section className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-extrabold text-[var(--color-text)]">Shake to Scan</h3>
                  {shakeEnabled && activeScanEvent && activeShakeEvent ? (
                    <p className="mt-1 text-[12px] font-semibold text-emerald-700">
                      Shake to Scan Enabled for {activeShakeEvent.title}
                    </p>
                  ) : (
                    <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                      Enable a single event for quick scanner access.
                    </p>
                  )}
                </div>
                {shakeEnabled && activeScanEvent ? (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setShakeError(null);
                    disableShake();
                  }}>
                    Disable
                  </Button>
                ) : null}
              </div>
              {motionSupported && motionPermission === "denied" && (
                <p className="mt-2 text-[11px] font-semibold text-red-600">
                  Motion access is blocked. Enable motion permissions in your browser settings.
                </p>
              )}
              {shakeError && (
                <p className="mt-2 text-[11px] font-semibold text-red-600">{shakeError}</p>
              )}
            </section>

            {/* Event cards */}
            {events.map((event) => {
              const expiringSoon = isExpiringSoon(event.volunteer_assignment?.expires_at);
              const assignedBy = event.volunteer_assignment?.assigned_by;

              return (
                <div key={event.event_id} className="card p-4">
                  <Link
                    href={`/volunteer/scanner/${encodeURIComponent(event.event_id)}`}
                    className="block active:scale-[0.99]"
                  >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                      <QrCodeIcon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate text-[15px] font-extrabold text-[var(--color-text)]">
                          {event.title}
                        </h3>
                        {/* Expiry badge — mirrors web platform amber warning */}
                        {expiringSoon && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            Expires soon
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1 text-[12px] text-[var(--color-text-muted)]">
                        <p className="flex items-center gap-1.5">
                          <CalendarDaysIcon size={12} className="text-[var(--color-primary)]" />
                          {formatDateShort(event.event_date)}
                        </p>
                        {event.event_time && (
                          <p className="flex items-center gap-1.5">
                            <Clock3Icon size={12} className="text-[var(--color-primary)]" />
                            {formatTime(event.event_time)}
                          </p>
                        )}
                        {event.venue && (
                          <p className="flex items-center gap-1.5 truncate">
                            <MapPinIcon size={12} className="text-[var(--color-primary)]" />
                            {event.venue}
                            {event.campus_hosted_at ? ` • ${event.campus_hosted_at}` : ""}
                          </p>
                        )}
                      </div>

                      {/* Assigned by — mirrors web platform footer */}
                      {assignedBy && (
                        <p className="mt-2 text-[11px] text-[var(--color-text-light)] truncate">
                          Assigned by: {assignedBy}
                        </p>
                      )}
                    </div>
                    <ArrowRightIcon size={18} className="mt-1 shrink-0 text-[var(--color-text-light)]" />
                  </div>

                  </Link>

                  {/* Shake-to-scan toggle row */}
                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-white/80 px-3 py-2">
                    <div>
                      <p className="text-[12px] font-semibold text-[var(--color-text)]">Shake to Scan</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {shakeEnabled && activeScanEvent === event.event_id
                          ? "Enabled"
                          : shakeEnabled && activeScanEvent
                            ? "Switch to this event"
                            : "Enable for this event"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Toggle Shake to Scan"
                      title="Toggle Shake to Scan"
                      onClick={() => {
                        void handleToggleShake(event.event_id);
                      }}
                      className={`relative h-7 w-12 overflow-hidden rounded-full transition-colors ${
                        shakeEnabled && activeScanEvent === event.event_id
                          ? "bg-emerald-500"
                          : "bg-slate-200"
                      }`}
                    >
                      <span className="sr-only">Toggle Shake to Scan</span>
                      <span
                        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                          shakeEnabled && activeScanEvent === event.event_id ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
