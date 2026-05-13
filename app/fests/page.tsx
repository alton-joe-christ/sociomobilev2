"use client";

import useSWR from "swr";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import FestCard from "@/components/FestCard";
import Skeleton from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { SearchIcon, XIcon, SparklesIcon, HeartIcon, CalendarIcon, FlameIcon, ArrowRightIcon, TrendingUpIcon, ShareIcon } from "@/components/icons";
import { Button } from "@/components/Button";
import { FilterChip } from "@/components/FilterChip";
import { apiRequest } from "@/lib/apiClient";
import { SWR_DEDUPING_MS } from "@/lib/cache/policy";
import { SectionContainer } from "@/components/SectionContainer";
import type { Fest } from "@/context/EventContext";
import { matchesSelectedCampus } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { useDebounce } from "@/lib/useDebounce";
import { formatDateRange, isDeadlinePassed } from "@/lib/dateUtils";
import { shareEvent } from "@/lib/share";

const fetcher = async (url: string) => {
  const data = await apiRequest(url) as any;
  const festArray = data?.fests ?? data?.data ?? data ?? [];
  return Array.isArray(festArray) ? festArray : [];
};

const ITEMS_PER_PAGE = 8;

export default function FestsPage() {
  const { userData } = useAuth();
  const [selectedCampus, setSelectedCampus] = useState(
    userData?.campus || "Central Campus (Main)"
  );

  const { data, error, isLoading, isValidating } = useSWR('/fests', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: SWR_DEDUPING_MS.hotRead,
    keepPreviousData: true,
  });

  const lastValidFests = useRef<any[]>([]);

  useEffect(() => {
    // Preserve the last valid data strictly to prevent empty flashes or corruption on aborted fetches
    if (data && Array.isArray(data) && !error) {
      lastValidFests.current = data;
    }
  }, [data, error]);

  // Use the active data if valid, otherwise fallback to our strictly held last known good state
  const fests = (data && !error) ? data : (lastValidFests.current.length > 0 ? lastValidFests.current : []);

  // Ensure we don't show "No fests found" prematurely while transitioning or fetching for the first time
  const isInitialLoading = isLoading || (!data && isValidating && lastValidFests.current.length === 0);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keep campus in sync if userData loads after mount
  useEffect(() => {
    if (userData?.campus && selectedCampus === "Central Campus (Main)") {
      setSelectedCampus(userData.campus);
    }
  }, [userData?.campus]);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  const filtered = useMemo(() => {
    // 1. Campus filter
    let list = fests.filter((f) =>
      matchesSelectedCampus(
        {
          campus_hosted_at: (f as any).campus_hosted_at,
          allowed_campuses: (f as any).allowed_campuses,
          venue: f.venue,
        },
        selectedCampus
      )
    );

    // 2. Text search
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (f) =>
          String(f.fest_title || f.name || "").toLowerCase().includes(q) ||
          String(f.organizing_dept || f.department || "").toLowerCase().includes(q)
      );
    }
    
    if (activeCategory === "Today") {
      const today = new Date().toDateString();
      list = list.filter(f => {
        const d = new Date(f.opening_date || (f as any).start_date || 0);
        return d.toDateString() === today;
      });
    } else if (activeCategory === "This Week") {
      const today = new Date();
      today.setHours(0,0,0,0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      list = list.filter(f => {
        const d = new Date(f.opening_date || (f as any).start_date || 0);
        return d >= today && d <= nextWeek;
      });
    } else if (activeCategory === "Free") {
      list = list.filter(f => !(f as any).registration_fee || (f as any).registration_fee === 0);
    } else if (activeCategory === "Popular") {
      list = [...list].sort((a, b) => {
        const aCount = (a as any).total_participants ?? (a as any).attendees ?? 0;
        const bCount = (b as any).total_participants ?? (b as any).attendees ?? 0;
        return bCount - aCount;
      });
    }

    if (activeCategory !== "Popular") {
      list = [...list].sort((a, b) => {
        const aClosed = isDeadlinePassed(a.closing_date || (a as any).end_date);
        const bClosed = isDeadlinePassed(b.closing_date || (b as any).end_date);
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        return new Date(a.opening_date || (a as any).start_date || 0).getTime() - new Date(b.opening_date || (b as any).start_date || 0).getTime();
      });
    }
    return list;
  }, [fests, debouncedSearch, activeCategory, selectedCampus]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const displayedFests = filtered.slice(0, startIdx + ITEMS_PER_PAGE);
  const hasMore = currentPage < totalPages;

  // Dynamically calculate the trending threshold based on the top 25% of fests
  const trendingThreshold = useMemo(() => {
    if (!fests || fests.length === 0) return Infinity;
    const counts = fests.map((f: any) => f.registrations ?? f.total_participants ?? f.attendees ?? 0).filter((c) => c > 0);
    if (counts.length === 0) return Infinity;
    counts.sort((a, b) => b - a);
    const index = Math.min(Math.max(1, Math.floor(counts.length * 0.25)), counts.length - 1);
    return Math.max(5, counts[index]);
  }, [fests]);

  const featuredFest = displayedFests.length > 0 ? displayedFests[0] : null;
  const upcomingFests = displayedFests.slice(1);

  // Prefetch featured fest data for instant transition
  useEffect(() => {
    if (featuredFest) {
      const id = featuredFest.slug || featuredFest.fest_id;
      if (id) void apiRequest(`/fests/${encodeURIComponent(id)}`);
    }
  }, [featuredFest]);

  return (
    <div className="pwa-page pt-2 pb-8 bg-[#f9fafb] max-w-[420px] mx-auto">
      {/* Search Bar Row — Only visible when searching */}
      {isSearchOpen && (
        <div className="px-5 h-[48px] flex flex-col justify-center animate-fade-in">
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none z-[1]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search fests..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-[38px] pl-9 pr-8 text-[13px] bg-[#e8e9ec] border-none rounded-xl outline-none transition-all placeholder:text-[var(--color-text-muted)] font-medium"
              />
              {search && (
                <button 
                  onClick={() => {
                    setSearch("");
                    setCurrentPage(1);
                  }} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] p-1 rounded-full hover:bg-black/5 z-[1]"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearch("");
                setCurrentPage(1);
              }}
              className="text-[12px] font-bold text-[var(--color-primary-dark)] shrink-0 px-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter chips row */}
      <div className="flex overflow-x-auto mb-1 gap-2.5 items-center no-scrollbar snap-x snap-mandatory h-[48px]">
        <div className="shrink-0 w-4 snap-start" aria-hidden />
        {!isSearchOpen && (
          <button
            onClick={() => setIsSearchOpen(true)}
            className="shrink-0 p-2 -ml-2 mr-1 flex items-center justify-center text-[var(--color-text)] transition-transform active:scale-95 snap-center"
            aria-label="Open search"
          >
            <SearchIcon size={20} strokeWidth={2.5} />
          </button>
        )}
        
        {["All", "Today", "This Week", "Free", "Popular"].map((filter) => {
          const active = filter === activeCategory;
          return (
            <div key={filter} className="snap-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory(filter);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all whitespace-nowrap ${
                  active
                    ? "bg-[var(--color-accent)] text-[var(--color-primary-dark)] shadow-sm"
                    : "bg-[#f3f4f6] text-[var(--color-text-muted)] hover:bg-[#e5e7eb]"
                }`}
              >
                {filter}
              </button>
            </div>
          );
        })}
        <div className="shrink-0 w-4 snap-end" aria-hidden />
      </div>


      {isInitialLoading ? (
        <div className="px-5 space-y-6">
          <Skeleton className="h-[400px] w-full rounded-[1.25rem]" />
          <Skeleton className="h-[220px] w-full rounded-[1.25rem]" count={2} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={<SparklesIcon size={28} className="text-[var(--color-primary)]" />}
            title="No fests found"
            subtitle={search ? "Try a different search" : "Check back soon for upcoming fests"}
          />
        </div>
      ) : (
        <>
          {/* Featured Fest */}
          {featuredFest && (
            <SectionContainer title="Featured Fest">
              <p className="text-[#434653] font-medium mb-3 -mt-2">
                Don't miss out on the biggest events this season.
              </p>

              <Link
                href={`/fest/${featuredFest.slug || featuredFest.fest_id}`}
                className="card-hero relative block w-full h-[400px] group cursor-pointer border border-white/40"
              >
                <Image
                  src={
                    (featuredFest.fest_image_url || featuredFest.banner_url || featuredFest.image_url)
                      ? (featuredFest.fest_image_url || featuredFest.banner_url || featuredFest.image_url)!
                      : "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop"
                  }
                  alt={featuredFest.fest_title || featuredFest.name || "Featured Fest"}
                  fill
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  priority
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                
                {((featuredFest as any).registrations ?? (featuredFest as any).total_participants ?? (featuredFest as any).attendees ?? 0) >= trendingThreshold && (
                  <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md rounded-full px-2 py-1 flex items-center gap-1 z-20 shadow-sm border border-white/10">
                    <TrendingUpIcon className="w-3.5 h-3.5 text-orange-400 animate-badge-pulse" />
                    <span className="text-white text-[10px] font-medium tracking-wide">Trending</span>
                  </div>
                )}

                <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
                  <div className="flex justify-between items-start">
                    <span className="bg-[#ffe08b] text-[#241a00] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm mt-8">
                      Featured
                    </span>
                    <div className="flex gap-2">
                      <button 
                        className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all active:scale-90"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void shareEvent({
                            title: featuredFest.fest_title || featuredFest.name || "Fest",
                            text: `Check out this fest: ${featuredFest.fest_title || featuredFest.name}`,
                            url: `/fest/${featuredFest.slug || featuredFest.fest_id}`,
                          });
                        }}
                      >
                        <ShareIcon size={20} className="text-white" />
                      </button>
                      <button 
                        className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all active:scale-90"
                        onClick={(e) => {
                          e.preventDefault();
                          // Add favorite logic here if needed
                        }}
                      >
                        <HeartIcon size={20} className="text-white" />
                      </button>
                    </div>

                  </div>
                  <div>
                    <h2 className="text-4xl font-extrabold text-white mb-2 leading-tight tracking-tight drop-shadow-md text-glow">
                      {featuredFest.fest_title || featuredFest.name}
                      <br />
                      <span className="text-2xl font-bold text-[#b2c5ff]">
                        {featuredFest.organizing_dept || featuredFest.department || "Cultural Extravaganza"}
                      </span>
                    </h2>
                    <div className="flex items-center gap-2 text-[#e2e2e2] mb-6 text-sm font-medium">
                      <CalendarIcon size={18} />
                      <span>
                        {formatDateRange(featuredFest.opening_date || featuredFest.start_date, featuredFest.closing_date || featuredFest.end_date)}
                      </span>
                      <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-xs ml-2 flex items-center gap-1 font-bold">
                        <FlameIcon size={14} /> Trending
                      </span>
                    </div>
                    <Button 
                      fullWidth 
                      variant={isDeadlinePassed(featuredFest.closing_date || (featuredFest as any).end_date) ? "ghost" : "primary"}
                      rightIcon={!isDeadlinePassed(featuredFest.closing_date || (featuredFest as any).end_date) ? <ArrowRightIcon size={20} /> : undefined}
                      className={isDeadlinePassed(featuredFest.closing_date || (featuredFest as any).end_date) ? "bg-white/10 text-white/50 cursor-not-allowed" : ""}
                    >
                      {isDeadlinePassed(featuredFest.closing_date || (featuredFest as any).end_date) ? "Closed" : "Explore Fest"}
                    </Button>
                  </div>
                </div>
              </Link>
            </SectionContainer>
          )}

          {/* Upcoming Fests */}
          {upcomingFests.length > 0 && (
            <SectionContainer title="Upcoming Fests">
              {hasMore && (
                <div className="flex justify-end mb-4 -mt-8 relative z-10">
                  <button 
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="text-[var(--color-primary-dark)] font-bold text-sm hover:underline"
                  >
                    Load More
                  </button>
                </div>
              )}
              <div className="space-y-6 stagger">
                {upcomingFests.map((f, idx) => (
                  <FestCard key={f.fest_id || f.id} fest={f} isTrending={((f as any).registrations ?? (f as any).total_participants ?? (f as any).attendees ?? 0) >= trendingThreshold} />
                ))}
              </div>
            </SectionContainer>
          )}
        </>
      )}
    </div>
  );
}
