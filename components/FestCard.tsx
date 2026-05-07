"use client";

import ShimmerImage from "./ShimmerImage";
import Link from "next/link";
import { CalendarIcon, UsersIcon, TrendingUpIcon, ShareIcon } from "@/components/icons";
import type { Fest } from "@/context/EventContext";
import { formatDateRange } from "@/lib/dateUtils";
import { shareEvent } from "@/lib/share";


function formatCompactCount(count: number) {
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count >= 1_000_000) {
    const value = count / 1_000_000;
    return `${parseFloat(value.toFixed(value >= 10 ? 0 : 1))}m`;
  }
  if (count >= 1_000) {
    const value = count / 1_000;
    return `${parseFloat(value.toFixed(value >= 10 ? 0 : 1))}k`;
  }
  return `${Math.round(count)}`;
}

type FestWithAttendance = Fest & {
  total_participants?: number | null;
  total_registrations?: number | null;
  registrations?: number | null;
  attendees?: number | null;
  attendee_count?: number | null;
};

export default function FestCard({ fest, isTrending }: { fest: Fest; isTrending?: boolean }) {
  const rawId = fest.slug || fest.fest_id;
  // Guard: do not render a broken link if the fest has no navigable ID
  if (!rawId) return null;

  const href = `/fest/${rawId}`;
  const img = fest.fest_image_url || fest.banner_url || fest.image_url;
  const title = fest.fest_title || fest.name || "Fest";
  const dept = fest.organizing_dept || fest.department;
  const festWithAttendance = fest as FestWithAttendance;
  const attendeeCountRaw = Number(
    festWithAttendance.total_participants ??
      festWithAttendance.total_registrations ??
      festWithAttendance.registrations ??
      festWithAttendance.attendees ??
      festWithAttendance.attendee_count ??
      0
  );
  const attendeeCount = Number.isFinite(attendeeCountRaw)
    ? Math.max(0, attendeeCountRaw)
    : 0;
  const attendeeLabel = formatCompactCount(attendeeCount);

  return (
    <Link
      href={href}
      className="card-elevated relative block w-full h-[220px] group cursor-pointer border border-white/40"
    >
      <ShimmerImage
        src={
          img ||
          [
            "https://images.unsplash.com/photo-1540509210214-411fb26dcf5a?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1000&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=1000&auto=format&fit=crop"
          ][(title.charCodeAt(0) || 0) % 4]
        }
        alt={title}
        fill
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        sizes="(max-width:480px) 100vw, 50vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
      
      {isTrending && (
        <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md rounded-full px-2 py-1 flex items-center gap-1 z-10 shadow-sm">
          <TrendingUpIcon className="w-3.5 h-3.5 text-orange-400 animate-badge-pulse" />
          <span className="text-white text-[10px] font-medium">Trending</span>
        </div>
      )}

      {/* Share Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void shareEvent({
            title: title,
            text: `Check out this fest: ${title}`,
            url: href,
          });
        }}
        className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-[var(--color-primary)] shadow-sm border border-white/20 active:scale-90 transition-transform"
        aria-label="Share Fest"
      >
        <ShareIcon size={16} />
      </button>


      <div className="absolute inset-0 p-5 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          {fest.category ? (
          <span className="bg-[var(--color-primary)] text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">
              {fest.category}
            </span>
          ) : (
            <div />
          )}
          {attendeeCount > 0 && (
            <span className="bg-black/50 backdrop-blur text-white/90 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide flex items-center gap-1.5 shadow-sm">
              <UsersIcon size={12} />
              {attendeeLabel} going
            </span>
          )}
        </div>
        <div>
          {dept && (
            <p className="text-[#dae2ff] font-semibold text-xs uppercase tracking-wider mb-1">
              {dept}
            </p>
          )}
          <h3 className="text-2xl font-bold text-white leading-tight mb-1 drop-shadow-md">
            {title}
          </h3>
          <div className="flex items-center gap-2 text-[#e2e2e2] text-xs font-medium">
            <CalendarIcon size={16} className="opacity-80" />
            <span>
              {formatDateRange(
                fest.opening_date || fest.start_date,
                fest.closing_date || fest.end_date
              )}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
