"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEvents, type FetchedEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeftIcon, CheckCircleIcon, AlertCircleIcon, Loader2Icon, UserIcon, HashIcon, MailIcon, UsersIcon, MessageCircleIcon } from "@/components/icons";
import { Button } from "@/components/Button";
import { apiRequest } from "@/lib/apiClient";
import { sanitizeUrl } from "@/lib/sanitizeUrl";

interface Teammate {
  name: string;
  registerNumber: string;
  email: string;
}

export default function RegisterClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { allEvents, isLoading: ctxLoading } = useEvents();
  const { userData, isLoading: authLoading } = useAuth();

  const [event, setEvent] = useState<FetchedEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const [teamName, setTeamName] = useState("");
  const [teammates, setTeammates] = useState<Teammate[]>([
    { name: "", registerNumber: "", email: "" },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const isTeam = event ? event.participants_per_team > 1 : false;
  const maxSize = event?.participants_per_team ?? 1;

  /* ── Load event ── */
  useEffect(() => {
    if (!eventId) return;
    if (ctxLoading) return;
    const found = allEvents.find((e) => e.event_id === eventId);
    if (found) {
      setEvent(found);
      setLoading(false);
      return;
    }
    apiRequest<any>(`/events/${eventId}`)
      .then((d) => setEvent(d.event ?? d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId, allEvents, ctxLoading]);

  /* ── Prefill first teammate ── */
  useEffect(() => {
    if (!event || authLoading || !userData) return;
    const initial: Teammate[] = [
      {
        name: userData.name || "",
        registerNumber:
          userData.organization_type === "outsider"
            ? userData.visitor_id || userData.register_number || ""
            : userData.register_number || "",
        email: userData.email || "",
      },
    ];
    if (isTeam) {
      for (let i = 1; i < maxSize; i++) {
        initial.push({ name: "", registerNumber: "", email: "" });
      }
    }
    setTeammates(initial);
  }, [event, userData, authLoading]);

  useEffect(() => {
    if (!event || !userData || authLoading) return;

    const registerNumber =
      userData.organization_type === "outsider"
        ? userData.visitor_id || userData.register_number || ""
        : userData.register_number || "";

    if (!registerNumber && !userData.email) return;

    const params = new URLSearchParams();
    if (registerNumber) params.set("registerNumber", String(registerNumber));
    if (userData.email) params.set("email", userData.email);

    apiRequest<any>(`/registrations?${params.toString()}`)
      .then((r) => (Array.isArray(r) ? r : (r as any)?.registrations ?? (r as any)?.events ?? []))
      .then((data) => {
        const registrations = Array.isArray(data) ? data : [];
        const ids = registrations
          .map((item: any) => item?.event_id || item?.id || item?.event?.event_id || item?.event?.id)
          .filter(Boolean)
          .map((id: any) => String(id));
        setAlreadyRegistered(ids.includes(String(event.event_id)));
      })
      .catch(() => {});
  }, [event, userData, authLoading]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (isTeam && !teamName.trim()) errs["teamName"] = "Required";
    teammates.forEach((t, i) => {
      if (!t.registerNumber.trim()) {
        errs[`${i}.registerNumber`] = "Required";
      } else {
        const rn = t.registerNumber.trim();
        if (!/^\d{7}$/.test(rn) && !/^VIS[A-Z0-9]+$/i.test(rn) && !/^STF[A-Z0-9]+$/i.test(rn)) {
          errs[`${i}.registerNumber`] = "Must be 7 digits or VIS.../STF... ID";
        }
      }
      if (i === 0) {
        if (!t.name.trim()) errs[`${i}.name`] = "Required";
        if (!t.email.trim()) errs[`${i}.email`] = "Required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email))
          errs[`${i}.email`] = "Invalid email";
      }
    });

    const seen = new Map<string, number>();
    teammates.forEach((t, i) => {
      const rn = t.registerNumber.trim();
      if (rn && !errs[`${i}.registerNumber`]) {
        if (seen.has(rn)) {
          errs[`${i}.registerNumber`] = "Duplicate";
          errs[`${seen.get(rn)!}.registerNumber`] = "Duplicate";
        }
        seen.set(rn, i);
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isOutsiderRestricted = event && !event.allow_outsiders && userData?.organization_type === "outsider";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (isOutsiderRestricted) {
      setRegError("This event is only for Christ University members. External participants cannot register.");
      return;
    }
    if (alreadyRegistered) {
      setRegError("You are already registered for this event.");
      return;
    }
    if (!validate() || !event) return;

    setSubmitting(true);
    try {
      await apiRequest<any>(`/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.event_id,
          teamName: isTeam ? teamName.trim() : null,
          teammates: teammates.map((t) => ({
            name: t.name.trim(),
            registerNumber: t.registerNumber.trim(),
            email: t.email.trim(),
          })),
        }),
      });
      setSuccess(true);
    } catch (err: any) {
      if (err.message?.includes("409") || err.code === "ALREADY_REGISTERED") {
        setRegError("You are already registered for this event.");
      } else {
        setRegError(err.message || "Registration failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const updateTeammate = (i: number, field: keyof Teammate, value: string) => {
    setTeammates((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [field]: value };
      return copy;
    });
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[`${i}.${field}`];
      return copy;
    });
  };

  if (loading || ctxLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2Icon className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!authLoading && !userData) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("returnTo", window.location.pathname);
    }
    router.replace("/auth");
    return null;
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6 text-center">
        <AlertCircleIcon size={40} className="text-red-400" />
        <p className="font-bold">Event not found</p>
        <Link href="/discover" className="btn btn-primary text-sm mt-2">Back</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-6">
        <div className="card p-6 text-center max-w-sm w-full animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold mb-1">You&apos;re in!</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-5">
            Registered for {event.title}
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/discover" className="btn btn-primary text-sm w-full">
              Back to Discover
            </Link>
            {event.whatsapp_invite_link && (
              <a
                href={sanitizeUrl(event.whatsapp_invite_link)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost text-sm w-full text-green-600 border-green-300"
              >
                <MessageCircleIcon size={16} /> Join WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? (
      <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
        <AlertCircleIcon size={11} /> {msg}
      </p>
    ) : null;

  return (
    <div className="pb-[calc(var(--bottom-nav)+var(--safe-bottom)+32px)]">
      <div className="bg-[var(--color-primary-dark)] text-white p-4 pb-5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-[var(--color-accent)] mb-3"
        >
          <ArrowLeftIcon size={16} /> Back
        </button>
        <h1 className="text-lg font-bold">{event.title}</h1>
        <p className="text-xs opacity-70 mt-0.5">
          {isTeam ? `Team registration · ${maxSize} members` : "Individual registration"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 mt-4 space-y-4">
        {alreadyRegistered && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-start gap-2">
            <CheckCircleIcon size={16} className="shrink-0 mt-0.5" />
            <span>You are already registered for this event.</span>
          </div>
        )}

        {isTeam && (
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1 block">
              <UsersIcon size={12} className="inline mr-1" /> Team Name
            </label>
            <input
              className={`input ${errors["teamName"] ? "input-error" : ""}`}
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                setErrors((p) => { const c = { ...p }; delete c["teamName"]; return c; });
              }}
              placeholder="Enter team name"
            />
            <FieldError msg={errors["teamName"]} />
          </div>
        )}

        {teammates.map((t, i) => (
          <div
            key={i}
            className="card p-4 space-y-3 animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {i === 0 ? "Your details" : `Member ${i + 1}`}
              </h3>
              {i === 0 && (
                <span className="chip bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px]">
                  {isTeam ? "Leader" : "You"}
                </span>
              )}
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-0.5 block">
                <UserIcon size={11} className="inline mr-1" /> Name
              </label>
              <input
                className={`input text-sm ${errors[`${i}.name`] ? "input-error" : ""}`}
                value={t.name}
                onChange={(e) => updateTeammate(i, "name", e.target.value)}
                placeholder="Full name"
                readOnly={i === 0}
              />
              <FieldError msg={errors[`${i}.name`]} />
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-0.5 block">
                <HashIcon size={11} className="inline mr-1" /> Register Number
              </label>
              <input
                className={`input text-sm ${errors[`${i}.registerNumber`] ? "input-error" : ""}`}
                value={t.registerNumber}
                onChange={(e) => updateTeammate(i, "registerNumber", e.target.value)}
                placeholder="7 digits / VIS... / STF..."
                readOnly={i === 0}
              />
              <FieldError msg={errors[`${i}.registerNumber`]} />
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-0.5 block">
                <MailIcon size={11} className="inline mr-1" /> Email
              </label>
              <input
                type="email"
                className={`input text-sm ${errors[`${i}.email`] ? "input-error" : ""}`}
                value={t.email}
                onChange={(e) => updateTeammate(i, "email", e.target.value)}
                placeholder="email@example.com"
                readOnly={i === 0}
              />
              <FieldError msg={errors[`${i}.email`]} />
            </div>
          </div>
        ))}

        {(regError || isOutsiderRestricted) && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
            <AlertCircleIcon size={16} className="shrink-0 mt-0.5" />
            <span>{isOutsiderRestricted ? "This event is only for Christ University members. External participants cannot register." : regError}</span>
          </div>
        )}

        <Button
          type="submit"
          variant={isOutsiderRestricted ? "danger" : "accent"}
          isLoading={submitting}
          disabled={alreadyRegistered || !!isOutsiderRestricted}
          className={`h-14 !rounded-2xl text-[15px] font-black tracking-tight transition-all active:scale-95 ${
            alreadyRegistered ? "!bg-emerald-50 !text-emerald-700 !border-emerald-200" : ""
          }`}
          leftIcon={alreadyRegistered ? <CheckCircleIcon size={18} /> : undefined}
        >
          {alreadyRegistered ? "Registered" : "Confirm Registration"}
        </Button>
      </form>
    </div>
  );
}
