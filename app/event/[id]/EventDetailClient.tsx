"use client";

import useSWR from "swr";
import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEvents, type FetchedEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { apiRequest } from "@/lib/apiClient";
import { formatDateUTC, formatTime, getDaysUntil, generateGoogleCalendarUrl } from "@/lib/dateUtils";
import {
  CalendarIcon as CalendarDays,
  ClockIcon as Clock,
  MapPinIcon as MapPin,
  UsersIcon as Users,
  TagIcon as Tag,
  TicketIcon as Ticket,
  GlobeIcon as Globe,
  FileTextIcon as FileText,
  TrophyIcon as Trophy,
  ListChecksIcon as ListChecks,
  PhoneIcon as Phone,
  MailIcon as Mail,
  MessageCircleIcon as MessageCircle,
  CheckCircleIcon as CheckCircle2,
  AlertCircleIcon as AlertCircle,
  Loader2Icon as Loader2,
  ChevronDownIcon as ChevronDown,
  ChevronUpIcon as ChevronUp,
  AwardIcon as Award,
  ShareIcon,
} from "@/components/icons";
import { Button } from "@/components/Button";
import { sanitizeUrl } from "@/lib/sanitizeUrl";
import { shareEvent } from "@/lib/share";

function parseJsonField<T>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item) => (typeof item === "object" && item !== null && "value" in item ? item.value : item)) as T[];
  if (typeof raw === "string") { try { return parseJsonField(JSON.parse(raw)); } catch { return []; } }
  return [];
}

const eventFetcher = async (url: string) => {
  const d = await apiRequest(url) as any;
  if (d && typeof d === 'object' && 'event' in d) return d.event;
  return d;
};

const regFetcher = async (url: string) => {
  const r = await apiRequest(url) as any;
  const data = Array.isArray(r) ? r : (r?.registrations ?? r?.events ?? []);
  const registrations = Array.isArray(data) ? data : [];
  return registrations.map((item: any) => item?.event_id || item?.id || item?.event?.event_id || item?.event?.id).filter(Boolean).map((id: any) => String(id));
};

const AccordionSection = ({ 
  id, 
  icon, 
  title, 
  children, 
  open, 
  onToggle 
}: { 
  id: string; 
  icon: ReactNode; 
  title: string; 
  children: ReactNode;
  open: boolean;
  onToggle: (id: string) => void;
}) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white mb-3 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all active:scale-[0.99]">
      <button
        onClick={() => onToggle(id)}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${open ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'}`}
      >
        <div className="flex items-center gap-3.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${open ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-blue-900/20' : 'bg-gray-50 text-gray-400'}`}>
            {icon}
          </div>
          <span className={`font-black text-[14px] tracking-tight ${open ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>{title}</span>
        </div>
        <div className={`transition-transform duration-300 ${open ? 'rotate-180' : 'rotate-0'}`}>
          <ChevronDown size={18} className={open ? 'text-[var(--color-primary)]' : 'text-gray-300'} />
        </div>
      </button>
      {open && <div className="px-5 pb-5 pt-0 text-[13px] border-t border-gray-50 animate-in fade-in slide-in-from-top-2 duration-300">{children}</div>}
    </div>
  );
};

export default function EventDetailClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { allEvents, isLoading: ctxLoading } = useEvents();
  const { userData, isLoading: authLoading } = useAuth();
  const { pushStatus, triggerPrompt } = useNotifications();

  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const toggle = (s: string) => setOpenSection(openSection === s ? null : s);

  useEffect(() => { if (regError && errorRef.current) { errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); errorRef.current.focus(); } }, [regError]);

  const foundEvent = allEvents.find((e) => e.event_id === eventId);
  const { data: fetchedEvent, error: fetchError, isLoading: fetchingEvent } = useSWR(
    !foundEvent && eventId && !ctxLoading ? `/events/${eventId}` : null,
    eventFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const event = foundEvent || fetchedEvent;
  const loading = ctxLoading || fetchingEvent;
  const error = (!event && !loading) ? "Event not found" : null;

  const regParams = new URLSearchParams();
  if (userData?.organization_type === "outsider" && (userData.visitor_id || userData.register_number)) {
    regParams.set("registerNumber", String(userData.visitor_id || userData.register_number));
  } else if (userData?.register_number) {
    regParams.set("registerNumber", String(userData.register_number));
  }
  if (userData?.email) regParams.set("email", userData.email);

  const shouldFetchReg = !!userData && !authLoading && (regParams.has("registerNumber") || regParams.has("email"));

  const { data: registeredIds = [], mutate: mutateRegisteredIds } = useSWR(
    shouldFetchReg ? `/registrations?${regParams.toString()}` : null,
    regFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const handleRegister = async () => {
    if (!event) return;
    setRegError(null);
    if (authLoading) { setRegError("Verifying user data, please wait..."); return; }
    if (!userData) { if (typeof window !== "undefined") sessionStorage.setItem("returnTo", window.location.pathname); router.push("/auth"); return; }
    if (userData.organization_type === "outsider" && !event.allow_outsiders) { setRegError("OUTSIDER_NOT_ALLOWED"); setTimeout(() => { errorRef.current?.focus(); errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 50); return; }
    const customFields = parseJsonField(event.custom_fields);
    if (customFields.length > 0 || event.participants_per_team > 1) { router.push(`/event/${event.event_id}/register`); return; }
    let regNum = "";
    if (userData.organization_type === "outsider") {
      const vis = userData.visitor_id || userData.register_number;
      if (!vis || !String(vis).toUpperCase().startsWith("VIS")) { setRegError("Missing Visitor ID (VIS...) in your profile."); return; }
      regNum = String(vis);
    } else {
      const regNumStr = String(userData.register_number || "");
      if (!/^(?:\d{7}|STF[A-Z0-9]+)$/i.test(regNumStr)) { setRegError("Invalid registration number in your profile."); return; }
      regNum = regNumStr;
    }
    setIsRegistering(true);
    try {
      await apiRequest<any>(`/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.event_id, teamName: null, teammates: [{ name: userData.name || "Unknown", registerNumber: regNum, email: userData.email || "" }] })
      });

      setShowSuccess(true);
      mutateRegisteredIds((p: string[] | undefined) => (p || []).includes(event.event_id) ? (p || []) : [...(p || []), event.event_id], false);
      if (pushStatus === "not_requested") {
        triggerPrompt();
      }
    } catch (err: any) {
      if (err.message?.includes("409") || err.code === "ALREADY_REGISTERED") {
        mutateRegisteredIds((p: string[] | undefined) => (p || []).includes(event.event_id) ? (p || []) : [...(p || []), event.event_id], false);
        setRegError(null);
      } else {
        setRegError(err.message || "Registration failed.");
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const isRegistered = event ? registeredIds.includes(event.event_id) : false;
  const daysLeft = event ? getDaysUntil(event.registration_deadline) : null;
  const isClosed = daysLeft !== null && daysLeft < 0;
  const isFree = !event?.registration_fee || event.registration_fee <= 0;
  const rules = event ? parseJsonField<string>(event.rules) : [];
  const schedule = event ? parseJsonField<{ time: string; activity: string }>(event.schedule) : [];
  const prizes = event ? parseJsonField<string>(event.prizes) : [];

  if (loading || ctxLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" /></div>;
  }
  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6 text-center">
        <AlertCircle size={40} className="text-red-400" />
        <p className="font-bold text-lg">{error || "Event not found"}</p>
        <Link href="/discover"><Button variant="primary" size="sm">Back to discover</Button></Link>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="card p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-black text-[var(--color-text)] mb-1">You&apos;re registered!</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">Successfully registered for {event.title}</p>
          <div className="flex flex-col gap-2">
            <Link href="/discover" className="block w-full"><Button variant="primary" size="sm" fullWidth>Back to Discover</Button></Link>
            {event.whatsapp_invite_link && (
              <a href={event.whatsapp_invite_link} target="_blank" rel="noopener noreferrer" className="block w-full">
                <Button variant="ghost" size="sm" fullWidth className="text-green-600 border border-green-300" leftIcon={<MessageCircle size={16} />}>Join WhatsApp</Button>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pwa-page bg-[#F5F7FA] overflow-y-auto !pb-[calc(var(--bottom-nav)+var(--safe-bottom)+140px)]">

      {/* ── Full-bleed hero ── */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: "75vw", maxHeight: 460 }}>
        <Image
          src={event.banner_url || event.event_image_url || "https://placehold.co/800x600/011F7B/ffffff?text=Event"}
          alt={event.title} fill className="object-cover" priority sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
        {/* chips top-left */}
        <div className="absolute top-[calc(var(--safe-top)+64px)] left-4 flex flex-wrap gap-2 z-10">
          <div className={`px-3 py-1 rounded-full shadow-md flex items-center gap-1.5 transition-all ${
            isFree 
              ? "bg-emerald-500 text-white animate-badge-pulse" 
              : "bg-[#FFBA09] text-[#011F7B]"
          }`}>
            <Ticket size={12} className={isFree ? "text-white opacity-90" : "text-[#011F7B] opacity-80"} />
            <span className="text-[10px] font-black uppercase tracking-wider">
              {isFree ? "Free Entry" : `₹${event.registration_fee}`}
            </span>
          </div>
          {event.allow_outsiders && (
            <div className="px-3 py-1 rounded-full bg-white/95 text-[var(--color-primary)] shadow-md flex items-center gap-1.5">
              <Globe size={12} className="opacity-80" />
              <span className="text-[10px] font-black uppercase tracking-wider">Open to all</span>
            </div>
          )}
          {event.claims_applicable && (
            <div className="px-3 py-1 rounded-full bg-[var(--color-primary)] text-white shadow-md flex items-center gap-1.5 border border-white/20">
              <Award size={12} className="opacity-90 text-[var(--color-accent)]" />
              <span className="text-[10px] font-black uppercase tracking-wider">Claims Info</span>
            </div>
          )}
        </div>

        {/* Share Action */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void shareEvent({
              title: event.title,
              text: `Check out this event: ${event.title}`,
              url: `/event/${event.event_id}`,
            });
          }}
          className="absolute top-[calc(var(--safe-top)+64px)] right-4 z-40 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
          aria-label="Share Event"
        >
          <ShareIcon size={20} />
        </button>
        {/* title area with extra bottom padding to prevent overlap */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-16 pt-24 z-10">
          {event.organizing_dept && (
            <p className="text-[11px] font-bold text-[var(--color-accent)] uppercase tracking-widest mb-1.5 drop-shadow-md">{event.organizing_dept}</p>
          )}
          <h1 className="text-[28px] font-black text-white leading-tight drop-shadow-xl">{event.title}</h1>
        </div>
      </div>

      {/* ── Meta card floats over hero ── */}
      <div className="mx-4 -mt-10 relative z-20 mb-6 bg-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(1,31,123,0.12)] border border-white">
        {/* rainbow accent bar */}
        <div className="h-[4px] w-full bg-gradient-to-r from-[#011F7B] via-[#4F6EF7] to-[#FFBA09] opacity-90" />
        <div className="p-5 grid grid-cols-1 gap-4">
          {/* Date */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 shadow-inner">
              <CalendarDays size={18} className="text-[var(--color-primary)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.1em]">Date</p>
              <p className="text-[15px] font-black text-[var(--color-text)] mt-0.5">
                {formatDateUTC(event.event_date)}{event.end_date && event.end_date !== event.event_date && <> – {formatDateUTC(event.end_date)}</>}
              </p>
            </div>
          </div>
          <div className="h-px bg-gray-100 w-full" />
          {/* Time & Venue Row */}
          <div className="grid grid-cols-2 gap-4">
            {event.event_time && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Clock size={16} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">Time</p>
                  <p className="text-[14px] font-bold text-[var(--color-text)]">{formatTime(event.event_time)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <MapPin size={16} className="text-[var(--color-primary)]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">Venue</p>
                <p className="text-[14px] font-bold text-[var(--color-text)] leading-tight truncate">{event.venue || "TBD"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status chips ── */}
      <div className="px-4 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {event.participants_per_team > 1 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-100">
              <Users size={11} /> Team of {event.participants_per_team}
            </span>
          )}
          {event.category && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-[var(--color-text-muted)] text-[11px] font-semibold border border-gray-200">
              <Tag size={11} /> {event.category}
            </span>
          )}
          {daysLeft !== null && !isClosed && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${daysLeft <= 3 ? "bg-red-50 text-red-600 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
              <Ticket size={11} /> {daysLeft === 0 ? "Last day!" : `${daysLeft}d left`}
            </span>
          )}
          {daysLeft === null && !isClosed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
              <Ticket size={11} /> Open registration
            </span>
          )}
          {isClosed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-400 text-[11px] font-semibold border border-gray-200">
              <Ticket size={11} /> Registration closed
            </span>
          )}
        </div>
      </div>

      {/* ── Content sections ── */}
      <div className="px-4 space-y-3">

        {/* About */}
        {event.description && (
          <div className="bg-white rounded-2xl p-4 border-l-4 border-l-[var(--color-primary)] border border-[var(--color-border)] shadow-sm">
            <h2 className="text-[11px] font-black text-[var(--color-primary)] uppercase tracking-widest mb-2">About</h2>
            <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {/* Accordion sections */}
        {rules.length > 0 && (
          <AccordionSection id="rules" icon={<ListChecks size={16} />} title={`Rules (${rules.length})`} open={openSection === 'rules'} onToggle={toggle}>
            <ul className="space-y-2 pt-3">
              {rules.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] text-[var(--color-text-muted)]">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  {String(r)}
                </li>
              ))}
            </ul>
          </AccordionSection>
        )}

        {schedule.length > 0 && (
          <AccordionSection id="schedule" icon={<Clock size={16} />} title="Schedule" open={openSection === 'schedule'} onToggle={toggle}>
            <div className="space-y-3 pt-3">
              {schedule.map((s, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="shrink-0 min-w-[56px] text-[11px] font-mono font-bold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-1 rounded-lg text-center">{s.time || `#${i + 1}`}</div>
                  <p className="text-[13px] text-[var(--color-text-muted)] pt-1">{s.activity}</p>
                </div>
              ))}
            </div>
          </AccordionSection>
        )}

        {prizes.length > 0 && (
          <AccordionSection id="prizes" icon={<Trophy size={16} />} title="Prizes" open={openSection === 'prizes'} onToggle={toggle}>
            <ul className="space-y-2 pt-3">
              {prizes.map((p, i) => (
                <li key={i} className="flex items-center gap-2.5 text-[13px] text-[var(--color-text-muted)]">
                  <Award size={14} className="text-[var(--color-accent-dark)] shrink-0" />
                  {String(p)}
                </li>
              ))}
            </ul>
          </AccordionSection>
        )}

        {/* PDF */}
        {event.pdf_url && (
          <a href={event.pdf_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-[var(--color-border)] shadow-sm active:bg-gray-50">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <FileText size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[var(--color-text)]">Event Document</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Tap to view PDF</p>
            </div>
          </a>
        )}

        {/* Add to Calendar */}
        {event.event_date && (
          <button
            onClick={() => {
              const url = generateGoogleCalendarUrl(event.title, event.event_date || "", event.event_time ?? undefined);
              if (url) window.open(url, "_blank");
            }}
            className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 border border-[var(--color-border)] shadow-sm active:bg-gray-50 text-left transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <CalendarDays size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[var(--color-text)]">Add to Calendar</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Save this event to Google Calendar</p>
            </div>
          </button>
        )}

        {/* Contact */}
        {(event.organizer_email || event.organizer_phone || event.whatsapp_invite_link) && (
          <div className="bg-white rounded-2xl p-4 border-l-4 border-l-[var(--color-accent-dark)] border border-[var(--color-border)] shadow-sm">
            <h3 className="text-sm font-black text-[var(--color-primary)] uppercase tracking-widest mb-4">Contact</h3>
            <div className="flex flex-col gap-2.5">
              {event.organizer_email && (
                <a href={`mailto:${event.organizer_email}`} className="flex items-center gap-3 text-[13px] text-[var(--color-text-muted)]">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Mail size={14} className="text-blue-600" />
                  </div>
                  <span className="truncate">{event.organizer_email}</span>
                </a>
              )}
              {event.organizer_phone && (
                <a href={`tel:${event.organizer_phone}`} className="flex items-center gap-3 text-[13px] text-[var(--color-text-muted)]">
                  <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-violet-600" />
                  </div>
                  <span>{event.organizer_phone}</span>
                </a>
              )}
              {event.whatsapp_invite_link && (
                <a href={sanitizeUrl(event.whatsapp_invite_link)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[13px] font-semibold text-green-700">
                  <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <MessageCircle size={14} className="text-green-600" />
                  </div>
                  Join WhatsApp Group
                </a>
              )}
            </div>
          </div>
        )}

        {/* Error feedback */}
        {regError && (
          regError === "OUTSIDER_NOT_ALLOWED" ? (
            <div ref={errorRef} tabIndex={-1} className="rounded-2xl bg-red-50 border border-red-200 p-4 outline-none">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertCircle size={18} className="text-red-600" />
                </div>
                <div>
                  <h4 className="font-bold text-red-800 text-[13px]">Members only</h4>
                  <p className="text-red-700 text-[12px] mt-0.5">This event is open to Christ University members only.</p>
                </div>
              </div>
            </div>
          ) : (
            <div ref={errorRef} tabIndex={-1} className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-[13px] text-amber-800 flex items-start gap-2.5 outline-none">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{regError}</span>
            </div>
          )
        )}
      </div>

      {/* ── Sticky CTA ── */}
      <div className="fixed bottom-[calc(var(--bottom-nav)+var(--safe-bottom)+10px)] left-1/2 -translate-x-1/2 w-[min(94vw,440px)] z-40">
        <div className="bg-white/95 backdrop-blur-md shadow-[0_-1px_0_rgba(0,0,0,0.05),0_10px_40px_rgba(1,31,123,0.22)] rounded-[24px] p-3.5 border border-white/50">
          <Button
            variant={isRegistered || isClosed ? "ghost" : "accent"}
            size="lg"
            fullWidth
            disabled={isRegistered || isClosed || isRegistering || authLoading}
            className={`h-14 !rounded-2xl text-[15px] font-black tracking-tight transition-all active:scale-95 ${
              isRegistered ? "!bg-emerald-50 !text-emerald-700 !border-emerald-200" :
              isClosed ? "!bg-gray-100 !text-gray-400 !border-gray-200" : ""
            }`}
            onClick={handleRegister}
            isLoading={isRegistering}
          >
            {isRegistering ? "Processing..." : isRegistered ? "Successfully Registered" : isClosed ? "Registration Closed" : `Register ${event.participants_per_team > 1 ? "Team" : "Now"} — ${isFree ? "FREE" : `₹${event.registration_fee}`}`}
          </Button>
          {event.participants_per_team > 1 && !isRegistered && !isClosed && (
            <p className="text-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mt-2">Registration is per team</p>
          )}
        </div>
      </div>
    </div>
  );
}
