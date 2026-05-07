"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useEvents, type FetchedEvent } from "@/context/EventContext";
import { CalendarDaysIcon, BellIcon, CompassIcon, ArrowRightIcon, MapPinIcon, Clock3Icon, FlameIcon, TicketIcon, QrCodeIcon, BuildingIcon } from "@/components/icons";
import { formatDateShort, formatTime, isDeadlinePassed } from "@/lib/dateUtils";
import { getActiveVolunteerEvents } from "@/lib/volunteerAccess";
import EventCardSkeleton from "@/components/skeletons/EventCardSkeleton";
import FestCardSkeleton from "@/components/skeletons/FestCardSkeleton";

function getEventDateValue(event: FetchedEvent) {
  return new Date(event.event_date || 0).getTime();
}

function getDaysFromToday(eventDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(eventDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getEventImage(event: FetchedEvent) {
  return (
    event.banner_url ||
    event.event_image_url ||
    "https://placehold.co/1200x800/E6ECF8/011F7B?text=SOCIO"
  );
}

function getQuickActions(notificationCount: number, volunteerCount: number) {
  const actions: { href: string; label: string; icon: any; tone: string; badge?: number }[] = [
    {
      href: "/discover",
      label: "Discover",
      icon: CompassIcon,
      tone: "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
    },
    {
      href: "/profile",
      label: "Registrations",
      icon: TicketIcon,
      tone: "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
    },
    {
      href: "/fests",
      label: "University\nFests",
      icon: FlameIcon,
      tone: "bg-[#fff4cf] text-[#745b00]",
    },
    {
      href: "/clubs",
      label: "Clubs &\nCentres",
      icon: BuildingIcon,
      tone: "bg-[#f1edfc] text-[#7c3aed]",
    },
  ];

  if (volunteerCount > 0) {
    actions.splice(2, 0, {
      href: "/volunteer",
      label: "Volunteer\nScanner",
      icon: QrCodeIcon,
      tone: "bg-[#e7f8ec] text-[#15803d]",
      badge: volunteerCount,
    });
  }

  return actions;
}

function UpcomingEventItem({ event }: { event: FetchedEvent }) {
  const isFree = !event.registration_fee || event.registration_fee === 0;
  const daysAway = getDaysFromToday(event.event_date);
  const statusLabel =
    daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : daysAway > 1 && daysAway <= 3 ? "Closing Soon" : null;

  return (
    <Link
      href={`/event/${event.event_id}`}
    className="group flex items-center gap-3 rounded-[18px] border border-white bg-white/82 px-3 py-3 shadow-[0_6px_18px_rgba(1,31,123,0.06)] backdrop-blur-sm transition-all hover:shadow-[0_10px_28px_rgba(1,31,123,0.12)] active:scale-[0.99]"
    >
      <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-[16px] bg-[var(--color-primary-light)]">
        <Image
          src={getEventImage(event)}
          alt={event.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="72px"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-extrabold text-[var(--color-text)]">{event.title}</h3>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--color-text-muted)]">
              {event.organizing_dept || event.fest || "Campus Event"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {statusLabel && (
              <span className="rounded-full bg-[#fff4cf] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[#745b00]">
                {statusLabel}
              </span>
            )}
            <ArrowRightIcon size={14} className="mt-0.5 text-[var(--color-text-light)]" />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <CalendarDaysIcon size={11} className="text-[var(--color-primary)]" />
            {formatDateShort(event.event_date)}
          </span>
          {event.event_time && (
            <span className="flex items-center gap-1">
              <Clock3Icon size={11} className="text-[var(--color-primary)]" />
              {formatTime(event.event_time)}
            </span>
          )}
          {event.venue && (
            <span className="flex items-center gap-1 truncate">
              <MapPinIcon size={11} className="text-[var(--color-primary)]" />
              {event.venue}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] ${
            isFree
              ? "bg-[#e7f8ec] text-[#15803d]"
              : "bg-[#fff2db] text-[#b45309]"
          }`}
        >
          {isFree ? "Free" : `Rs ${event.registration_fee}`}
        </span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { userData, isLoading: authLoading } = useAuth();
  const { allEvents, isLoading: eventsLoading } = useEvents();
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  const isDataLoading = !isHydrated || eventsLoading;

  const activeEvents = [...allEvents]
    .filter((event) => {
      const eventTime = getEventDateValue(event);
      return Number.isFinite(eventTime);
    })
    .sort((a, b) => getEventDateValue(a) - getEventDateValue(b));

  const upcomingEvents = activeEvents
    .filter((event) => getDaysFromToday(event.event_date) >= 0)
    .slice(0, 5);

  const featuredEvent =
    upcomingEvents.find((event) => !isDeadlinePassed(event.registration_deadline)) ||
    activeEvents[0] ||
    null;

  const festSpotlight = activeEvents.find((event) => event.fest && event.fest.toLowerCase() !== "none") || null;

  const isVisitor = userData?.organization_type === "outsider";
  const firstName = userData?.name?.split(" ")?.[0] || (isVisitor ? "Visitor" : "there");
  const notificationCount = 0;
  const activeVolunteerEvents = getActiveVolunteerEvents(userData?.volunteerEvents);
  const quickActions = getQuickActions(notificationCount, activeVolunteerEvents.length);

  const currentHour = new Date().getHours();
  let greetingText = "Good morning";
  if (currentHour >= 12 && currentHour < 17) greetingText = "Good afternoon";
  else if (currentHour >= 17) greetingText = "Good evening";

  if (firstName === "Visitor") {
    greetingText = "Welcome";
  }

  return (
    <div
      className="pwa-page relative overflow-hidden px-5 pb-[calc(var(--bottom-nav)+var(--safe-bottom)+96px)]"
      style={{ paddingTop: "calc(var(--nav-height) + var(--safe-top) + 16px)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 10% 20%, rgba(1,31,123,0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(116,91,0,0.05) 0%, transparent 40%), repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(0,0,0,0.02) 24px), repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(0,0,0,0.02) 24px)",
        }}
      />
      <div className="pointer-events-none absolute -top-10 right-[-60px] h-60 w-60 rounded-full bg-[var(--color-primary)]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-[-60px] h-56 w-56 rounded-full bg-[var(--color-accent)]/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-[420px] space-y-6">
        <section className="space-y-1 pt-2">
          <h1 className="text-[30px] font-black leading-tight tracking-[-0.03em] text-[var(--color-text)]">
            {greetingText}, <span className="text-[var(--color-primary)]">{firstName === "Visitor" ? "Visitor" : firstName + "."}</span>
          </h1>
          <p className="max-w-[320px] text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Here&apos;s your curated feed of what&apos;s happening around campus this week.
          </p>
        </section>


        {!isHydrated || !featuredEvent ? (
          <section>
            <EventCardSkeleton featured />
          </section>
        ) : (
          <section>
            <Link
              href={`/event/${featuredEvent.event_id}`}
              className="group relative block h-56 overflow-hidden rounded-[22px] shadow-[0_10px_30px_rgba(1,31,123,0.14)]"
            >
              <Image
                src={getEventImage(featuredEvent)}
                alt={featuredEvent.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 480px) 100vw, 420px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,13,59,0.92)] via-[rgba(1,31,123,0.35)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-40 backdrop-blur-md [mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.12)_18%,rgba(0,0,0,0.72)_48%,black_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <span className="mb-2 inline-flex rounded-full bg-[#ffe08b] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#584400]">
                      {featuredEvent.fest && featuredEvent.fest.toLowerCase() !== "none" ? "Major Fest" : "Featured Event"}
                    </span>
                    <h2 className="text-[22px] font-extrabold leading-tight text-white">
                      {featuredEvent.title}
                    </h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-white/82">
                      <span className="flex items-center gap-1">
                        <CalendarDaysIcon size={13} />
                        {formatDateShort(featuredEvent.event_date)}
                      </span>
                      {featuredEvent.venue && (
                        <span className="flex items-center gap-1">
                          <MapPinIcon size={13} />
                          {featuredEvent.venue}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-xl bg-white px-4 py-2 text-[13px] font-extrabold text-[var(--color-primary)] shadow-sm">
                    View Event
                  </span>
                </div>
              </div>
            </Link>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-[18px] font-extrabold tracking-[-0.02em] text-[var(--color-text)] pl-3 border-l-[3px] border-[var(--color-accent)]">
            Quick Actions
          </h2>
          <div className="grid grid-cols-4 gap-2.5">
            {quickActions.map(({ href, label, icon: Icon, tone, badge }) => (
              <Link
                key={href}
                href={href}
                className="relative flex h-[110px] min-w-0 flex-col items-center justify-center gap-2 rounded-[18px] border border-white bg-white/86 px-1.5 py-3 text-center shadow-[0_6px_18px_rgba(0,0,0,0.04)] backdrop-blur-sm transition-all hover:bg-white active:scale-[0.98]"
              >
                {badge ? (
                  <span className="absolute top-2 right-2 min-w-[18px] rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                ) : null}
                <div className={`flex h-11 w-11 items-center justify-center rounded-full ${tone}`}>
                  <Icon size={20} />
                </div>
                <span className="flex h-[25px] w-full items-center justify-center whitespace-pre-line text-center text-[9px] font-extrabold leading-[1.15] text-[var(--color-text)]">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {!isHydrated || upcomingEvents.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--color-text)] pl-3 border-l-[3px] border-[var(--color-accent)]">
                Upcoming Events
              </h2>
              <Link href="/events" className="flex items-center gap-1 text-[12px] font-bold text-[var(--color-primary)]">
                See all <ArrowRightIcon size={13} />
              </Link>
            </div>
            <div className="space-y-3">
              {!isHydrated ? (
                <EventCardSkeleton count={3} />
              ) : (
                upcomingEvents.map((event) => (
                  <UpcomingEventItem key={event.event_id} event={event} />
                ))
              )}
            </div>
          </section>
        ) : null}

        {!isHydrated || festSpotlight ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--color-text)] pl-3 border-l-[3px] border-[var(--color-accent)]">
                Fest Spotlight
              </h2>
              <Link href="/fests" className="flex items-center gap-1 text-[12px] font-bold text-[var(--color-primary)]">
                See Fest <ArrowRightIcon size={13} />
              </Link>
            </div>

            {!isHydrated ? (
              <FestCardSkeleton />
            ) : (
              <Link
                href={festSpotlight!.fest ? "/fests" : `/event/${festSpotlight!.event_id}`}
                className="group relative block overflow-hidden rounded-[22px] border border-white bg-white/85 shadow-[0_8px_24px_rgba(1,31,123,0.08)] backdrop-blur-sm"
              >
                <div className="relative h-40">
                  <Image
                    src={getEventImage(festSpotlight!)}
                    alt={festSpotlight!.fest || festSpotlight!.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 480px) 100vw, 420px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="text-[20px] font-extrabold leading-tight text-white">
                      {festSpotlight!.fest || festSpotlight!.title}
                    </h3>
                    <p className="mt-1 text-[12px] text-white/80">
                      {festSpotlight!.organizing_dept || "Campus-wide spotlight"}
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </section>
        ) : null}

        {isHydrated && allEvents.length === 0 && (
          <section className="rounded-[22px] border border-white bg-white/85 px-5 py-8 text-center shadow-[0_8px_24px_rgba(1,31,123,0.06)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
              <CalendarDaysIcon className="h-7 w-7 text-[var(--color-primary)]" />
            </div>
            <h2 className="text-[18px] font-extrabold text-[var(--color-text)]">No events yet</h2>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              Check back soon for upcoming campus events and fest announcements.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
