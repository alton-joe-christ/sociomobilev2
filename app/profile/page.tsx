"use client";

import useSWR from "swr";
import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/context/EventContext";
import Skeleton from "@/components/Skeleton";
import LoadingScreen from "@/components/LoadingScreen";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import {
  HashIcon as Hash,
  GraduationCapIcon as GraduationCap,
  BuildingIcon as Building,
  CalendarIcon as CalendarDays,
  ChevronRightIcon as ChevronRight,
  BellIcon as Bell,
  TicketIcon as Ticket,
  MapPinIcon as MapPin,
  PencilIcon as Pencil,
  QrCodeIcon as QrCode,
  ClockIcon as Clock3,
  CheckCircleIcon as CheckCircle2,
  XCircleIcon as XCircle,
  MailIcon as Mail,
  SearchIcon,
  XIcon,
  SettingsIcon,
  ChefHatIcon as ChefHat,
  UtensilsIcon as Utensils,
} from "@/components/icons";
import { Button } from "@/components/Button";
import type { FetchedEvent } from "@/context/EventContext";
import { getActiveVolunteerEvents } from "@/lib/volunteerAccess";
import { apiRequest } from "@/lib/apiClient";

const getStatus = (dateStr: string) => {
  if (!dateStr) return "Upcoming";
  const eventDate = new Date(dateStr);
  const now = new Date();
  eventDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  if (eventDate < now) return "Past";
  if (eventDate.getTime() === now.getTime()) return "Today";
  return "Upcoming";
};

const regFetcher = async (url: string) => {
  const res = await apiRequest(url, { cache: "no-store" }) as any;
  if (!res) return [];
  const regs = Array.isArray(res) ? res : res.registrations ?? res ?? [];
  return (Array.isArray(regs) ? regs : [])
    .map((r: any) => ({
      event_id: String(r?.event_id || r?.id || r?.event?.event_id || r?.event?.id || ""),
      registration_id: String(
        r?.registration_id ||
        r?.id ||
        r?.event?.registration_id ||
        r?.event?.id ||
        ""
      ),
      title: r?.event?.title || r?.title || r?.name || "",
      raw_date: r?.event?.event_date || r?.event_date || r?.date || "",
      department: r?.event?.organizing_dept || r?.organizing_dept || r?.department || "",
      status: getStatus(r?.event?.event_date || r?.event_date || r?.date || ""),
      event: r?.event,
    }))
    .filter((r: Registration) => Boolean(r.event_id) && Boolean(r.registration_id));
};

interface Registration {
  event_id: string;
  registration_id: string;
  title?: string;
  raw_date?: string;
  department?: string;
  status?: string;
  event?: FetchedEvent;
}

export default function ProfilePage() {
  const { userData, isLoading, signOut, session, refreshUserData } = useAuth();
  const { allEvents } = useEvents();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [nameEditError, setNameEditError] = useState<string | null>(null);
  const [activeQR, setActiveQR] = useState<{ registrationId: string; eventTitle: string } | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  const formatDate = (rawDate?: string) => {
    if (!rawDate) return "Date TBA";
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return "Date TBA";
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const isEventSoon = (rawDate?: string) => {
    if (!rawDate) return false;
    const eventStart = new Date(`${rawDate}T00:00:00`);
    if (Number.isNaN(eventStart.getTime())) return false;
    return eventStart.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  };

  const registerNumber =
    userData?.organization_type === "outsider"
      ? userData.visitor_id || userData.register_number || ""
      : userData?.register_number || "";

  const params = new URLSearchParams();
  if (registerNumber) params.set("registerNumber", registerNumber);
  if (userData?.email) params.set("email", userData.email);

  const shouldFetch = !!userData && (!!registerNumber || !!userData.email);

  const { data: registrations = [], isLoading: regLoading, mutate: mutateRegistrations } = useSWR(
    shouldFetch ? `/registrations?${params.toString()}` : null,
    regFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  // Deduplicate registrations by event_id and enrich with event data
  const uniqueRegistrations = useMemo(() => {
    const seen = new Map<string, Registration>();
    for (const r of registrations) {
      if (!seen.has(r.event_id)) {
        // Enrich with event data from context
        const event = allEvents.find((e) => e.event_id === r.event_id);
        seen.set(r.event_id, {
          ...r,
          event,
          title: r.title || event?.title || `Event ${r.event_id}`,
          raw_date: r.raw_date || event?.event_date,
          department: r.department || event?.organizing_dept || "Department TBA",
          status: r.status || getStatus(r.raw_date || event?.event_date),
        });
      }
    }
    return Array.from(seen.values());
  }, [registrations, allEvents]);

  const filteredRegistrations = useMemo(() => {
    let result = uniqueRegistrations;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        (r.title || "").toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [uniqueRegistrations, searchQuery]);

  const totalPages = Math.ceil(filteredRegistrations.length / ITEMS_PER_PAGE);
  const paginatedRegistrations = filteredRegistrations.slice(0, currentPage * ITEMS_PER_PAGE);
  const activeVolunteerEvents = useMemo(
    () => getActiveVolunteerEvents(userData?.volunteerEvents),
    [userData?.volunteerEvents]
  );

  const handleCancelRegistration = async (registration: Registration) => {
    if (!session?.access_token || cancellingId) return;

    setCancellingId(registration.registration_id);
    setCancelConfirmId(null);
    try {
      await apiRequest<any>(`/registrations/self/${encodeURIComponent(registration.registration_id)}`, {
        method: "DELETE",
        cache: "no-store",
      });

      mutateRegistrations((prev) => (prev || []).filter((r) => r.registration_id !== registration.registration_id), false);
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    if (!isLoading && !session) router.replace("/auth");
  }, [isLoading, session, router]);

  if (isLoading) return <LoadingScreen />;
  if (!userData) return <LoadingScreen />;

  const isVisitor = userData.organization_type === "outsider";
  const canEditName = isVisitor && !userData.outsider_name_edit_used;
  const visitorId = userData.visitor_id || userData.register_number || "";

  const submitNameEdit = async () => {
    setNameEditError(null);
    if (!nameInput.trim()) {
      setNameEditError("Name cannot be empty");
      return;
    }

    setIsSubmittingName(true);
    try {
      await apiRequest(`/users/${encodeURIComponent(userData.email)}/name`, {
        method: "PUT",
        body: JSON.stringify({
          name: nameInput.trim(),
          visitor_id: visitorId,
        }),
      });

      setIsEditingName(false);
      await refreshUserData();
    } catch (err: any) {
      setNameEditError(err.message || "Network error");
    } finally {
      setIsSubmittingName(false);
    }
  };

  const infoRows = [
    { icon: Mail, label: "Email", value: userData.email },
    visitorId && { icon: Hash, label: isVisitor ? "Visitor ID" : "Register No.", value: visitorId },
    !isVisitor && userData.course && { icon: GraduationCap, label: "Course", value: userData.course },
    !isVisitor && userData.department && { icon: Building, label: "Department", value: userData.department },
    !isVisitor && userData.campus && { icon: MapPin, label: "Campus", value: userData.campus },
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  return (
    <div className="pwa-page pt-[calc(var(--nav-height)+var(--safe-top))] pb-[calc(var(--bottom-nav)+var(--safe-bottom)+100px)]">
      {/* Profile header */}
      <div className="relative overflow-hidden text-white px-5 pt-12 pb-10">
        {/* Cover background */}
        {userData && (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-[var(--color-primary-dark)] via-[var(--color-primary)] to-[#3b5bdb]">
            {/* Decorative subtle glows */}
            <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-black/20 rounded-full blur-2xl" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a1835]/80 via-transparent to-transparent" />
          </div>
        )}
        
        <div className="flex items-center gap-4 relative z-10">
          {userData.avatar_url ? (
            <Image
              src={userData.avatar_url}
              alt={userData.name}
              width={60}
              height={60}
              className="rounded-full ring-4 ring-offset-2 ring-offset-[#0a1428] ring-[#1a3a7a] object-cover shadow-2xl"
            />
          ) : (
            <div className="w-[60px] h-[60px] rounded-full bg-white/20 flex items-center justify-center text-xl font-bold ring-4 ring-offset-2 ring-offset-[#0a1428] ring-[#1a3a7a] shadow-xl">
              {userData.name?.[0]?.toUpperCase() || "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-extrabold truncate">{userData.name}</h1>
              {canEditName && (
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(userData.name || "");
                    setIsEditingName(true);
                    setNameEditError(null);
                  }}
                  className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0"
                  aria-label="Edit display name"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
            <p className="text-[12px] opacity-75 mt-0.5">
              {isVisitor ? "External Visitor" : "Christ University"}
            </p>
            {isVisitor && visitorId && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2.5 py-1 text-[var(--color-primary-dark)] text-[11px] font-extrabold tracking-wide">
                {visitorId}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="px-4 -mt-5 relative z-10 grid grid-cols-1 gap-3 mb-4">
        <Link href="/profile/settings" className="flex-1 card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center">
            <SettingsIcon size={17} className="text-[var(--color-text-muted)]" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-[13px] font-bold">Settings</p>
          </div>
          <ChevronRight size={15} className="text-[var(--color-text-light)]" />
        </Link>
        {((userData?.volunteerEvents?.length ?? 0) > 0) && (
          <Link href="/volunteer" className="flex-1 card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <QrCode size={17} className="text-[var(--color-primary)]" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-[13px] font-bold">Volunteer Dashboard</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {activeVolunteerEvents.length > 0 
                  ? `${activeVolunteerEvents.length} active assignment${activeVolunteerEvents.length === 1 ? "" : "s"}`
                  : "View assignments & scanner"}
              </p>
            </div>
            <ChevronRight size={15} className="text-[var(--color-text-light)]" />
          </Link>
        )}
        {(userData?.roles?.catering || (userData?.caters && userData.caters.length > 0)) && (
          <Link href="/catering" className="flex-1 card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center">
              <Utensils size={17} className="text-orange-600" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-[13px] font-bold">Catering</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Manage food orders & bookings</p>
            </div>
            <ChevronRight size={15} className="text-[var(--color-text-light)]" />
          </Link>
        )}
      </div>

      {/* Info Card */}
      <div className="px-4 mb-4">
        <div className="card divide-y divide-[var(--color-border)]">
          {infoRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-2.5">
              <Icon size={15} className="text-[var(--color-text-muted)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[var(--color-text-light)] uppercase tracking-wide">{label}</p>
                <p className="text-[13px] font-semibold truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Registered events — deduplicated + compact */}
      <div className="px-4 mb-4">
        {!isSearchOpen ? (
          <div className="flex items-center gap-2 mb-3 animate-fade-in">
            <Ticket size={15} className="text-[var(--color-primary)] shrink-0" />
            <h2 className="text-[15px] font-extrabold">Registered Events</h2>
            
            {(uniqueRegistrations.length > 0 || searchQuery) && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="ml-auto w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-black/5 transition-colors"
                aria-label="Search registrations"
              >
                <SearchIcon size={16} />
              </button>
            )}

            {uniqueRegistrations.length > 0 && (
              <span className={`text-[11px] font-bold text-[var(--color-text-muted)] bg-gray-100 px-2 py-0.5 rounded-full ${uniqueRegistrations.length === 0 && !searchQuery ? "ml-auto" : ""}`}>
                {uniqueRegistrations.length}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-3 animate-fade-in">
            <div className="relative flex-1">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search registered events..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white text-[13px] border border-[var(--color-border)] rounded-xl py-2 pl-9 pr-8 focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent outline-none shadow-sm transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1 rounded-full bg-gray-100"
                >
                  <XIcon size={12} />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="text-[13px] font-bold text-[var(--color-primary)] px-2 shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {regLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-[var(--radius)]" count={2} />
          </div>
        ) : uniqueRegistrations.length === 0 ? (
          <div className="card p-6 text-center">
            <CalendarDays size={28} className="mx-auto text-[var(--color-text-light)] mb-2" />
            <p className="text-[13px] font-semibold text-[var(--color-text-muted)]">
              No registrations yet
            </p>
            <p className="text-[12px] text-[var(--color-text-light)] mt-0.5">
              Browse events and register to see them here
            </p>
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-[13px] font-semibold text-[var(--color-text-muted)]">
              No matching events found
            </p>
          </div>
        ) : (
          <div className="space-y-2 stagger">
                {paginatedRegistrations.map((r) => {
              const isUpcoming = r.status !== "completed";
              const tooLateToCancel = isEventSoon(r.raw_date);
              const eventTitle = r.title || `Event ${r.event_id}`;

              return (
                <div key={r.registration_id} className="card p-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center ${
                        isUpcoming ? "bg-blue-100 text-[var(--color-primary)]" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {isUpcoming ? <Clock3 size={16} /> : <CheckCircle2 size={16} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link href={`/event/${r.event_id}`} className="text-[13px] font-bold text-[var(--color-primary)] hover:underline block truncate">
                        {eventTitle}
                      </Link>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        {formatDate(r.raw_date)}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-light)] truncate">
                        {r.department || "Department TBA"}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isUpcoming ? "bg-blue-50 text-[var(--color-primary)]" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isUpcoming ? "Upcoming" : "Completed"}
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveQR({ registrationId: r.registration_id, eventTitle })}
                      className="flex-1"
                      leftIcon={<QrCode size={14} />}
                    >
                      Generate QR
                    </Button>

                    {isUpcoming && (
                      <Button
                        variant={tooLateToCancel ? "ghost" : "danger"}
                        size="sm"
                        onClick={() => setCancelConfirmId(r.registration_id)}
                        disabled={tooLateToCancel || cancellingId === r.registration_id}
                        className={`flex-1 ${tooLateToCancel ? "bg-gray-200 text-gray-500 cursor-not-allowed" : ""}`}
                        leftIcon={!tooLateToCancel && cancellingId !== r.registration_id ? <XCircle size={14} /> : undefined}
                      >
                        {cancellingId === r.registration_id ? (
                          "Cancelling..."
                        ) : tooLateToCancel ? (
                          "Locked <24h"
                        ) : (
                          "Cancel"
                        )}
                      </Button>
                    )}
                  </div>

                  {cancelConfirmId === r.registration_id && (
                    <div className="mt-3 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3">
                      <p className="text-[12px] font-semibold text-red-700">
                        Cancel this registration?
                      </p>
                      <p className="text-[11px] text-red-600 mt-1">
                        This action cannot be undone.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1"
                          onClick={() => setCancelConfirmId(null)}
                        >
                          Keep
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleCancelRegistration(r)}
                        >
                          Confirm Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {currentPage < totalPages && (
          <Button
            variant="outline"
            className="w-full mt-3 text-[13px] font-bold py-2 border-[var(--color-border)] text-[var(--color-text)] bg-white shadow-sm"
            onClick={() => setCurrentPage((prev) => prev + 1)}
          >
          Load More Events
          </Button>
        )}
      </div>

      {isEditingName && (
        <div className="modal-backdrop">
          <div className="modal-card overflow-hidden">
            <div className="bg-[var(--color-primary-dark)] px-5 py-4">
              <h3 className="text-lg font-bold text-white">Edit Your Name</h3>
              <p className="text-blue-100 text-xs mt-0.5">This can only be done once</p>
            </div>
            <div className="p-5">
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="input w-full"
                placeholder="Enter your full name"
                autoFocus
              />

              {nameEditError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-red-700 text-xs">{nameEditError}</p>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[11px] text-amber-800">
                  Check the spelling carefully. Visitor names can be updated only once.
                </p>
              </div>

              <div className="flex gap-2 mt-5">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setIsEditingName(false);
                    setNameEditError(null);
                  }}
                  disabled={isSubmittingName}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={submitNameEdit}
                  disabled={isSubmittingName || !nameInput.trim()}
                >
                  {isSubmittingName ? "Saving..." : "Save Name"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeQR && (
        <QRCodeDisplay
          registrationId={activeQR.registrationId}
          eventTitle={activeQR.eventTitle}
          participantName={userData.name || "Participant"}
          onClose={() => setActiveQR(null)}
        />
      )}
    </div>
  );
}
