"use client";

import ShimmerImage from "./ShimmerImage";
import Link from "next/link";
import { MapPinIcon, ClockIcon, UsersIcon, TrendingUpIcon, ShareIcon } from "@/components/icons";
import type { FetchedEvent } from "@/context/EventContext";
import { formatDateShort, formatTime, getDaysUntil, isDeadlinePassed } from "@/lib/dateUtils";
import { shareEvent } from "@/lib/share";

export default function EventCard({
  event,
  compact,
  featured,
  showAction,
  isTrending,
}: {
  event: FetchedEvent;
  compact?: boolean;
  featured?: boolean;
  showAction?: boolean;
  isTrending?: boolean;
}) {
  // Guard: do not render a broken link if event has no valid ID
  if (!event?.event_id) return null;

  const daysLeft = getDaysUntil(event.registration_deadline);
  const closed = isDeadlinePassed(event.registration_deadline);
  const isFree = !event.registration_fee || event.registration_fee === 0;

  // Compact variant for profile registrations
  if (compact) {
    return (
      <Link href={`/event/${event.event_id}`} className="flex gap-3 items-center p-3 bg-white rounded-[var(--radius)] shadow-[var(--shadow-xs)] animate-fade-up group">
        <div className="relative w-16 h-16 rounded-[var(--radius-sm)] overflow-hidden shrink-0 bg-gray-100">
          {(event.banner_url || event.event_image_url) ? (
            <ShimmerImage src={(event.banner_url || event.event_image_url)!} alt={event.title} fill className="object-cover" sizes="64px" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] to-[#1a6bdb] flex items-center justify-center">
              <span className="text-white font-bold text-sm">{event.title.charAt(0)}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[13px] font-extrabold leading-tight line-clamp-1">{event.title}</h4>
          <p className="text-[11px] font-medium text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1">
            <ClockIcon size={10} /> {formatDateShort(event.event_date)}
            {event.event_time && ` · ${formatTime(event.event_time)}`}
          </p>
          {event.venue && (
            <p className="text-[11px] text-[var(--color-text-light)] mt-0.5 flex items-center gap-1 truncate">
              <MapPinIcon size={10} /> {event.venue}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {!closed && (
            isFree ? (
              <span className="tag tag-free">Free</span>
            ) : (
              <span className="tag tag-paid">₹{event.registration_fee}</span>
            )
          )}
        </div>
      </Link>
    );
  }

  const cardClasses = `block animate-fade-up group bg-[var(--color-surface)] rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] overflow-hidden transition-transform duration-200 active:scale-[0.96] ${featured ? 'card-hero' : ''}`;

  return (
    <Link href={`/event/${event.event_id}`} className={cardClasses}>
      {/* Banner */}
      <div className={`relative ${featured ? "aspect-[16/10]" : "aspect-[16/9]"} bg-gray-100 overflow-hidden`}>
        {event.event_image_url || event.banner_url ? (
          <ShimmerImage
            src={(event.banner_url || event.event_image_url)!}
            alt={event.title}
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            sizes="(max-width:480px) 100vw, 50vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center">
            <span className="text-white/50 text-4xl font-black">
              {event.title.charAt(0)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-2 z-[1]">
          {isTrending && (
            <div className="bg-black/50 backdrop-blur-md rounded-full px-2 py-1 flex items-center gap-1 shadow-sm border border-white/10">
              <TrendingUpIcon className="w-3.5 h-3.5 text-orange-400 animate-badge-pulse" />
              <span className="text-white text-[10px] font-medium tracking-wide">Trending</span>
            </div>
          )}
          
          {!closed && (
            isFree ? (
              <span className="tag rounded-md bg-white/95 text-emerald-700 font-bold px-2 py-1 shadow-sm uppercase">
                FREE
              </span>
            ) : (
              <span className="tag rounded-md bg-white/95 text-amber-700 font-bold px-2 py-1 shadow-sm">
                ₹{event.registration_fee}
              </span>
            )
          )}
        </div>

        {/* Share Button */}
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
          className="absolute top-3 right-3 z-[1] w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-[var(--color-primary)] shadow-sm border border-white/20 active:scale-90 transition-transform"
          aria-label="Share Event"
        >
          <ShareIcon size={16} />
        </button>
      </div>

      {/* Body */}
      <div className={featured ? "p-5" : "p-4"}>
        {/* Date / Time */}
        <p className="text-[10px] font-bold tracking-widest text-[var(--color-text-light)] uppercase flex items-center gap-1 mb-1.5">
          <ClockIcon size={10} />
          {formatDateShort(event.event_date)}
          {event.event_time && ` • ${formatTime(event.event_time)}`}
        </p>

        {/* Title */}
        <h3 className={featured ? "text-[22px] font-extrabold leading-tight line-clamp-2" : "text-[16px] font-extrabold leading-snug line-clamp-2"}>
          {event.title}
        </h3>

        {/* Tags */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {event.category && (
            <span className="chip bg-[#fff4cf] text-[#745b00] text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm">
              {event.category}
            </span>
          )}
          {(event.organizing_dept || event.fest) && (
            <span className="chip bg-gray-100 text-[var(--color-text-muted)] text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm">
              {event.organizing_dept || event.fest}
            </span>
          )}
        </div>

        {/* Footer (Social Proof & CTA) */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(event.total_participants != null && event.total_participants > 0) ? (
              <>
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-black/5 text-black/40 border border-black/10">
                  <UsersIcon size={12} />
                </div>
                <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                  +{event.total_participants} Attending
                </span>
              </>
            ) : (
              <span className="text-[11px] font-semibold text-[var(--color-text-muted)] flex items-center gap-1">
                {event.venue ? <><MapPinIcon size={11} /> {event.venue}</> : 'Details inside'}
              </span>
            )}
          </div>
          
          {showAction && (
            <span className={`btn-active-state shrink-0 inline-flex items-center justify-center rounded-lg font-bold transition-all ${
              closed 
                ? "bg-slate-100 text-slate-400 px-3 py-1.5 text-[12px] opacity-90 cursor-not-allowed" 
                : "bg-[var(--color-accent)] text-[var(--color-primary-dark)] px-4 py-1.5 text-[12px] hover:bg-[var(--color-accent-dark)] hover:text-white"
            }`}>
              {closed ? "Closed" : "Grab Ticket"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
