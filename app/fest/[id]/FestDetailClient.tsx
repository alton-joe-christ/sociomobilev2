"use client";

import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEvents } from "@/context/EventContext";
import EventCard from "@/components/EventCard";
import {
  ArrowLeftIcon as ArrowLeft,
  ShareIcon,
} from "@/components/icons";
import { shareEvent } from "@/lib/share";
import { apiRequest } from "@/lib/apiClient";
import LoadingScreen from "@/components/LoadingScreen";

const fetcher = async (url: string) => {
  const d = await apiRequest(url) as any;
  return d.fest ?? d;
};

export default function FestDetailClient({ festId }: { festId: string }) {
  const router = useRouter();
  const { allEvents, isLoading: ctxLoading, refreshEvents } = useEvents();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Proactively refresh events if we have none, to ensure fest events show up
    if (allEvents.length === 0) {
      void refreshEvents();
    }
  }, [allEvents.length, refreshEvents]);

  const { data: fest, error, isLoading: loading } = useSWR(
    festId ? `/fests/${encodeURIComponent(festId)}` : null,
    fetcher,
    { 
      revalidateOnFocus: false, 
      dedupingInterval: 60000,
      shouldRetryOnError: true
    }
  );

  const festEvents = useMemo(() => {
    if (!fest || !allEvents.length) return [];
    // Filter events belonging to this fest. 
    // Handle both ID and Slug matching if the backend returns them.
    return allEvents.filter((e) => e.fest === fest.fest_id || e.fest === fest.slug);
  }, [fest, allEvents]);

  if (!mounted || loading || (ctxLoading && allEvents.length === 0)) {
    return <LoadingScreen />;
  }

  if (error || !fest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6 text-center">
        <p className="font-bold text-lg text-[var(--color-text)]">{error?.message || "Fest not found"}</p>
        <p className="text-sm text-[var(--color-text-muted)] -mt-1 mb-2">
          We couldn't load the details for this fest.
        </p>
        <Link href="/fests" className="btn btn-primary btn-sm">
          Back to fests
        </Link>
      </div>
    );
  }

  return (
    <div className="pwa-page pb-24 pt-[calc(var(--nav-height)+var(--safe-top)+16px)] animate-fade-in">
      <div className="px-4 mb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)]"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="relative aspect-[16/9] mx-4 rounded-2xl overflow-hidden shadow-lg border border-white/20">
        <Image
          src={fest.banner_url || fest.fest_image_url || "https://placehold.co/800x450/011F7B/ffffff?text=Fest"}
          alt={fest.fest_title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void shareEvent({
              title: fest.fest_title,
              text: `Check out this fest: ${fest.fest_title}`,
              url: `/fest/${fest.slug || fest.fest_id}`,
            });
          }}
          className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
          aria-label="Share Fest"
        >
          <ShareIcon size={20} />
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-[#dae2ff] font-bold text-xs uppercase tracking-wider mb-1">
            {fest.organizing_dept || "University Fest"}
          </p>
          <h1 className="text-2xl font-black text-white leading-tight">{fest.fest_title}</h1>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="card p-5">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            About the Fest
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            {fest.description || "No description available for this fest yet. Stay tuned for updates!"}
          </p>
        </div>
      </div>

      <div className="px-4 mt-8">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xl font-black">Events in this Fest</h2>
          <span className="text-xs font-bold text-[var(--color-text-muted)] bg-gray-100 px-2 py-1 rounded-full">
            {festEvents.length} {festEvents.length === 1 ? 'Event' : 'Events'}
          </span>
        </div>

        {festEvents.length > 0 ? (
          <div className="space-y-4">
            {festEvents.map((event) => (
              <EventCard key={event.event_id} event={event} />
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center bg-gray-50/50 border-dashed border-2">
            <p className="text-sm font-semibold text-[var(--color-text-muted)]">
              No events found for this fest yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
