"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, type VolunteerEvent } from "@/context/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";
import QRScanner from "@/components/QRScanner";
import { Button } from "@/components/Button";
import { AlertTriangleIcon, ArrowLeftIcon, QrCodeIcon, ShieldCheckIcon } from "@/components/icons";
import { getActiveVolunteerEvents } from "@/lib/volunteerAccess";
import { PWA_API_URL } from "@/lib/apiConfig";

const DENIED_MESSAGE = "You do not have permission to access this feature";

export default function ScannerClient() {
  const params = useParams();
  const router = useRouter();
  const eventId = String(params?.eventId || "");
  const { session, userData, isLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [event, setEvent] = useState<VolunteerEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cachedEvent = useMemo(() => {
    return getActiveVolunteerEvents(userData?.volunteerEvents).find(
      (item) => item.event_id === eventId
    ) || null;
  }, [eventId, userData?.volunteerEvents]);

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/auth");
    }
  }, [isLoading, router, session]);

  useEffect(() => {
    if (isLoading) return;
    if (!eventId || !session?.access_token) {
      setIsChecking(false);
      setError(DENIED_MESSAGE);
      return;
    }

    let cancelled = false;

    async function validateAccess() {
      setIsChecking(true);
      setError(null);
      setEvent(cachedEvent);

      try {
        const res = await fetch(`${PWA_API_URL}/volunteer/events/${encodeURIComponent(eventId)}/access`, {
          headers: {
            Authorization: `Bearer ${session!.access_token}`,
          },
          cache: "no-store",
        });
        const payload = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (payload.authorized === false) {
          setEvent(null);
          setError(payload.error || DENIED_MESSAGE);
          return;
        }

        if (!res.ok) {
          if (cachedEvent) {
            console.warn("Scanner access validation failed, falling back to cached event.");
            setEvent(cachedEvent);
          } else {
            setEvent(null);
            setError(payload.error || DENIED_MESSAGE);
          }
          return;
        }

        setEvent(payload.event || cachedEvent);
      } catch {
        if (!cancelled) {
          if (cachedEvent) {
             setEvent(cachedEvent);
          } else {
             setEvent(null);
             setError("Unable to validate scanner access.");
          }
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }

    void validateAccess();

    return () => {
      cancelled = true;
    };
  }, [cachedEvent, eventId, isLoading, session]);

  if (isLoading || (isChecking && !event)) {
    return <LoadingScreen />;
  }

  if (!event || error) {
    return (
      <div className="pwa-page min-h-screen px-4 pb-[calc(var(--bottom-nav)+var(--safe-bottom)+96px)] pt-[calc(var(--nav-height)+var(--safe-top)+16px)]">
        <div className="mx-auto max-w-[420px]">
          <section className="card p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangleIcon size={22} />
            </div>
            <h1 className="text-[17px] font-extrabold text-[var(--color-text)]">Access denied</h1>
            <p className="mx-auto mt-2 max-w-[280px] text-[13px] leading-5 text-[var(--color-text-muted)]">
              {error || DENIED_MESSAGE}
            </p>
            <Button variant="primary" className="mt-4" onClick={() => router.replace("/")}>
              Back Home
            </Button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="pwa-page min-h-screen px-4 pb-[calc(var(--bottom-nav)+var(--safe-bottom)+96px)] pt-[calc(var(--nav-height)+var(--safe-top)+16px)]">
      <div className="mx-auto max-w-[420px] space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/volunteer"
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-primary)]"
          >
            <ArrowLeftIcon size={15} />
            Dashboard
          </Link>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            <ShieldCheckIcon size={13} />
            Authorized
          </span>
        </div>

        <section className="rounded-[24px] bg-[var(--color-primary-dark)] px-5 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12">
              <QrCodeIcon size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[19px] font-black">{event.title}</h1>
              <p className="mt-1 text-[12px] leading-5 text-blue-100">
                Scan only tickets for this assigned event.
              </p>
            </div>
          </div>
        </section>

        <QRScanner eventId={event.event_id} />
      </div>
    </div>
  );
}
