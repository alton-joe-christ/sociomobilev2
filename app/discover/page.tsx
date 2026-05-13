"use client";

import useSWR from "swr";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useEvents } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import EventCard from "@/components/EventCard";
import EventCardSkeleton from "@/components/skeletons/EventCardSkeleton";
import FestCardSkeleton from "@/components/skeletons/FestCardSkeleton";
import EmptyState from "@/components/EmptyState";
import { SearchIcon, XIcon, ArrowRightIcon, CalendarIcon, MapPinIcon, SparklesIcon, UsersIcon, FlameIcon, TrendingUpIcon, BuildingIcon } from "@/components/icons";
import { FilterChip } from "@/components/FilterChip";
import { Button } from "@/components/Button";
import { SectionContainer } from "@/components/SectionContainer";
import { formatDateShort, isDeadlinePassed } from "@/lib/dateUtils";
import type { Fest } from "@/context/EventContext";
import { useDebounce } from "@/lib/useDebounce";
import { apiRequest } from "@/lib/apiClient";

const fetcher = async (url: string) => {
  const data = await apiRequest(url) as any;
  const arr = data.fests ?? data.data ?? data ?? [];
  return Array.isArray(arr) ? arr : [];
};

const ITEMS_PER_PAGE = 10;
const QUICK_CATEGORY_LIMIT = 4;
const GRID_CATEGORY_LIMIT = 4;

function normalizeFestLabel(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function formatCompactCount(count: number): string {
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

export default function DiscoverPage() {
  const { allEvents, isLoading } = useEvents();
  const { userData } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  
  // Advanced Filter System
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(["Open"]));
  
  const [currentPage, setCurrentPage] = useState(1);
  const [fests, setFests] = useState<Fest[]>([]);
  const [festsLoading, setFestsLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  /* Fetch actual fests from API */
  useEffect(() => {
    (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const data = (await apiRequest(`/fests`)) as any;
        const arr = data.fests ?? data.data ?? data ?? [];
        setFests(Array.isArray(arr) ? arr : []);
      } catch {}
      finally {
        clearTimeout(timeoutId);
        setFestsLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    allEvents.forEach((event) => {
      const category = event.category?.trim();
      if (category) {
        counts.set(category, (counts.get(category) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, QUICK_CATEGORY_LIMIT);
  }, [allEvents]);

  const categoryGrid = useMemo(
    () => categories.slice(0, GRID_CATEGORY_LIMIT),
    [categories]
  );

  const festRegistrationMap = useMemo(() => {
    const map = new Map<string, number>();
    allEvents.forEach((event) => {
      const key = normalizeFestLabel(event.fest);
      if (!key || key === "none") return;
      const count = Math.max(0, event.total_participants ?? 0);
      map.set(key, (map.get(key) ?? 0) + count);
    });
    return map;
  }, [allEvents]);

  const trendingFests = useMemo(() => {
    return [...fests]
      .map((fest) => {
        const title = fest.fest_title || fest.name || "";
        const key = normalizeFestLabel(title);
        const registrations = key ? festRegistrationMap.get(key) ?? 0 : 0;
        return { fest, registrations };
      })
      .sort((a, b) => {
        if (b.registrations !== a.registrations) return b.registrations - a.registrations;
        const aTitle = a.fest.fest_title || a.fest.name || "";
        const bTitle = b.fest.fest_title || b.fest.name || "";
        return aTitle.localeCompare(bTitle);
      })
      .slice(0, 6);
  }, [fests, festRegistrationMap]);

  // Personalization: Curated For You
  const curatedEvents = useMemo(() => {
    if (!userData?.department) return [];
    const dept = userData.department.toLowerCase();
    
    // Simple heuristic: match organizing_dept or category to user's department
    return allEvents.filter(e => 
      !isDeadlinePassed(e.registration_deadline) &&
      (e.organizing_dept?.toLowerCase() === dept || e.category?.toLowerCase() === dept)
    ).slice(0, 5);
  }, [allEvents, userData?.department]);

  const isTimeFilter = (f: string) => ["Today", "This Week"].includes(f);
  const isStatusFilter = (f: string) => ["Free", "Trending", "Open"].includes(f);

  /* Filter events based on search and active filters */
  const filtered = useMemo(() => {
    let list = allEvents;
    
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter(
        (e) =>
          String(e.title || "").toLowerCase().includes(q) ||
          String(e.venue || "").toLowerCase().includes(q) ||
          String(e.fest || "").toLowerCase().includes(q) ||
          String(e.category || "").toLowerCase().includes(q)
      );
    }
    
    // Status Filters
    if (activeFilters.has("Open")) {
      list = list.filter((e) => !isDeadlinePassed(e.registration_deadline));
    }
    if (activeFilters.has("Free")) {
      list = list.filter(e => !e.registration_fee || e.registration_fee === 0);
    }
    if (activeFilters.has("Trending")) {
      // Just a simple heuristic for trending events (e.g. top participants)
      list = list.filter(e => (e.total_participants ?? 0) >= 5);
    }

    // Time Filters
    if (activeFilters.has("Today")) {
      const today = new Date().toDateString();
      list = list.filter(e => new Date(e.event_date).toDateString() === today);
    } else if (activeFilters.has("This Week")) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      list = list.filter(e => {
        const d = new Date(e.event_date);
        return d >= today && d <= nextWeek;
      });
    }

    // Category Filters
    const activeCategories = Array.from(activeFilters).filter(f => !isTimeFilter(f) && !isStatusFilter(f));
    if (activeCategories.length > 0) {
      list = list.filter(e => activeCategories.some(c => e.category?.toLowerCase() === c.toLowerCase()));
    }

    return list.sort((a, b) => {
      const aClosed = isDeadlinePassed(a.registration_deadline);
      const bClosed = isDeadlinePassed(b.registration_deadline);
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
    });
  }, [allEvents, debouncedSearch, activeFilters]);

  const toggleFilter = (filter: string) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      // If setting a time filter, remove other time filters to make them mutually exclusive
      if (isTimeFilter(filter)) {
        newFilters.delete("Today");
        newFilters.delete("This Week");
      }
      newFilters.add(filter);
    }
    setActiveFilters(newFilters);
    setCurrentPage(1);
  };

  const allFiltered = filtered;
  const spotlightEvents = allFiltered.slice(0, 1); // Hero takes 1
  
  // Exclude spotlight event from the rest of the list
  const listWithoutSpotlight = allFiltered.filter(e => !spotlightEvents.some(s => s.event_id === e.event_id));
  
  const totalPages = Math.ceil(listWithoutSpotlight.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const displayedEvents = listWithoutSpotlight.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  /* Auto-scroll for Trending Fests */
  const scrollRef = useRef<HTMLDivElement>(null);
  const curatedScrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  const handleUserInteraction = useCallback(() => {
    pausedRef.current = true;
    setTimeout(() => {
      pausedRef.current = false;
    }, 4000);
  }, []);

  return (
    <div className="pwa-page pt-2 pb-8 bg-[#f9fafb] max-w-[420px] mx-auto">
      {/* Search Bar Row — Only visible when searching */}
      {isSearchOpen && (
        <div className="px-5 h-[48px] flex flex-col justify-center animate-fade-in">
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none z-[1]"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search events, clubs..."
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
        
        {/* Dynamic Filters List */}
        {[
          "Open", "Free", "Trending", 
          "Today", "This Week", 
          ...categories
        ].map((filter) => {
          const active = activeFilters.has(filter);
          return (
            <div key={filter} className="snap-center shrink-0">
              <button
                type="button"
                onClick={() => toggleFilter(filter)}
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

      {!isHydrated || isLoading ? (
        <div className="px-5 space-y-6 pt-4">
          <EventCardSkeleton featured />
          <div className="space-y-4">
            <div className="skeleton h-6 w-32 rounded mb-4" />
            <EventCardSkeleton count={2} />
          </div>
        </div>
      ) : (
        <>
          {/* 1. Spotlight Hero Card */}
          {spotlightEvents.length > 0 && (
            <SectionContainer title="Spotlight" actionLabel="See All" actionHref="/events" className="animate-fade-up">
              <Link href={`/event/${spotlightEvents[0].event_id}`} className="group relative block overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1b2533] to-[#0a1835] shadow-[0_12px_36px_rgba(10,24,53,0.3)] aspect-[4/5] max-h-[460px] btn-active-state will-change-transform">
                {/* Background effects & Image */}
                <div className="absolute inset-0 opacity-60 z-0">
                  <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[var(--color-primary)] rounded-full blur-[100px] z-0" />
                  <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[var(--color-accent)]/20 rounded-full blur-[80px] z-0" />
                  {(spotlightEvents[0].banner_url || spotlightEvents[0].event_image_url) && (
                    <Image
                      src={(spotlightEvents[0].banner_url || spotlightEvents[0].event_image_url)!}
                      alt={spotlightEvents[0].title}
                      fill
                      priority
                      className="object-cover mix-blend-overlay group-hover:scale-[1.03] transition-transform duration-700 ease-out z-[1] will-change-transform"
                      sizes="(max-width: 768px) 100vw, 800px"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a1835] via-[#0a1835]/60 to-transparent z-[2]" />
                </div>
                
                <div className="absolute inset-0 p-6 flex flex-col justify-end z-10">
                  <span className="self-start mb-4 chip bg-[#fff4cf] text-[#745b00] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded shadow-sm">
                    SPOTLIGHT
                  </span>
                  
                  <h2 className="text-[32px] font-black leading-[1.1] text-white tracking-[-0.02em] mb-4 drop-shadow-md">
                    {spotlightEvents[0].title}
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-start gap-2">
                      <CalendarIcon size={16} className="text-white/70 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-white text-[13px] font-medium leading-tight">
                          {formatDateShort(spotlightEvents[0].event_date)}
                        </span>
                        {spotlightEvents[0].event_time && (
                          <span className="text-white/70 text-[11px] mt-0.5">
                            {formatDateShort(spotlightEvents[0].event_date).split(',')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    {spotlightEvents[0].venue && (
                      <div className="flex items-start gap-2">
                        <MapPinIcon size={16} className="text-white/70 mt-0.5" />
                        <span className="text-white text-[13px] font-medium leading-tight line-clamp-2">
                          {spotlightEvents[0].venue}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <Button variant="secondary" fullWidth rightIcon={<ArrowRightIcon size={16} />}>
                    Secure Your Seat
                  </Button>
                </div>
              </Link>
            </SectionContainer>
          )}

          {/* 2. Curated For You (Personalization) */}
          {curatedEvents.length > 0 && !debouncedSearch && (
            <div className="pb-6 animate-fade-up" style={{ animationDelay: '100ms' }}>
              <div className="px-5 pb-3 flex flex-col justify-start">
                <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Curated For You</h2>
                <p className="text-[12px] text-[var(--color-text-muted)] font-medium">Based on your department: {userData?.department}</p>
              </div>
              <div
                ref={curatedScrollRef}
                onTouchStart={handleUserInteraction}
                onMouseDown={handleUserInteraction}
                className="flex overflow-x-auto gap-3.5 snap-x snap-mandatory scroll-smooth pb-2 no-scrollbar will-change-scroll"
              >
                <div className="shrink-0 w-5 snap-start" aria-hidden />
                {curatedEvents.map((e) => (
                  <div key={e.event_id} className="w-[calc(100vw-60px)] max-w-[320px] shrink-0 snap-center">
                    <EventCard event={e} />
                  </div>
                ))}
                <div className="shrink-0 w-5 snap-end" aria-hidden />
              </div>
            </div>
          )}

          {/* 3. Trending Fests / Events */}
          {(festsLoading || fests.length > 0) && !debouncedSearch && (
            <div className="pb-6 animate-fade-up" style={{ animationDelay: '150ms' }}>
              <div className="px-5 pb-3 flex items-center justify-between">
                <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Trending Now</h2>
                <Link href="/fests" className="text-[12px] font-bold text-[var(--color-primary-dark)] hover:underline">
                  View All
                </Link>
              </div>
              <div
                ref={scrollRef}
                onTouchStart={handleUserInteraction}
                onMouseDown={handleUserInteraction}
                className="flex overflow-x-auto gap-3.5 snap-x snap-mandatory scroll-smooth pb-2 no-scrollbar will-change-scroll"
              >
                {/* left spacer */}
                <div className="shrink-0 w-5 snap-start" aria-hidden />
                {festsLoading
                  ? Array.from({ length: 2 }).map((_, idx) => (
                      <div
                        key={`fest-skeleton-${idx}`}
                        className="card-elevated w-[calc(100vw-40px)] max-w-[380px] shrink-0 snap-center"
                      >
                        <div className="skeleton aspect-[16/10]" />
                        <div className="p-4 space-y-2">
                          <div className="skeleton h-4 w-3/4" />
                          <div className="skeleton h-3 w-2/3" />
                          <div className="skeleton h-9 w-28 rounded-[var(--radius)]" />
                        </div>
                      </div>
                    ))
                  : trendingFests.map(({ fest: f, registrations }) => {
                      const img = f.fest_image_url || f.banner_url || f.image_url;
                      const title = f.fest_title || f.name || "Fest";
                      return (
                        <Link
                          key={f.fest_id || f.id}
                          href={`/fest/${f.slug || f.fest_id}`}
                          data-fest-card
                          className="card-elevated group w-[calc(100vw-40px)] max-w-[380px] flex-shrink-0 snap-center btn-active-state will-change-transform"
                        >
                          <div className="relative aspect-[16/10] bg-[var(--color-primary-light)] overflow-hidden">
                            {img ? (
                              <Image
                                src={img}
                                alt={title}
                                fill
                                loading="lazy"
                                className="object-cover transition-transform duration-500 group-hover:scale-[1.03] will-change-transform"
                                sizes="(max-width:480px) 70vw, 280px"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary-dark)] to-[var(--color-primary)] flex items-center justify-center">
                                <span className="text-white font-extrabold text-2xl opacity-35">{title.charAt(0)}</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                            
                            <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md rounded-full px-2 py-1 flex items-center gap-1 z-10 shadow-sm border border-white/10">
                              <TrendingUpIcon className="w-3.5 h-3.5 text-orange-400 animate-badge-pulse" />
                              <span className="text-white text-[10px] font-medium tracking-wide">Trending</span>
                            </div>

                            <span className="absolute top-2.5 right-2.5 chip bg-white/92 text-[var(--color-primary)] text-[10px] font-bold shadow-sm">
                              Fest
                            </span>
                          </div>

                          <div className="p-4">
                            <p className="text-[15px] font-extrabold leading-tight line-clamp-1">{title}</p>
                            <p className="text-[11px] font-medium text-[var(--color-text-muted)] mt-1 line-clamp-1">
                              {f.organizing_dept || f.department || "Campus Fest"}
                            </p>
                            <div className="mt-3.5 flex items-center gap-2">
                              {registrations > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-white/90 backdrop-blur-md whitespace-nowrap">
                                  <UsersIcon size={12} />
                                  {formatCompactCount(registrations)} going
                                </span>
                              )}
                              <span className="btn-active-state ml-auto inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-3.5 py-2 text-[12px] font-bold text-white shadow-[var(--shadow-primary)] transition-all duration-200">
                                Register
                                <ArrowRightIcon size={13} />
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                {/* right spacer */}
                <div className="shrink-0 w-5 snap-end" aria-hidden />
              </div>
            </div>
          )}

          {/* 4. Browse by Vibe (Categories) */}
          {categoryGrid.length > 0 && !debouncedSearch && activeFilters.size <= 1 && (
            <SectionContainer title="Browse by Vibe" actionLabel="View All" actionHref="/events" className="animate-fade-up" style={{ animationDelay: '200ms' }}>
              <div className="grid grid-cols-2 gap-3">
                {/* Full Width Card */}
                {categoryGrid[0] && (
                  <button
                    onClick={() => toggleFilter(categoryGrid[0])}
                    className="col-span-2 relative bg-[#eef0ff] rounded-2xl p-5 overflow-hidden text-left btn-active-state border border-transparent hover:border-[#d0d6ff] transition-all min-h-[110px] flex flex-col justify-center will-change-transform"
                  >
                    <div className="relative z-10">
                      <div className="w-8 h-8 rounded-full bg-[#3b5bdb] text-white flex items-center justify-center mb-2 shadow-sm">
                         <FlameIcon size={16} />
                      </div>
                      <h3 className="text-[18px] font-black text-[#263161] leading-tight mb-1">{categoryGrid[0]}</h3>
                      <p className="text-[12px] text-[#55629c] font-medium">Explore the best</p>
                    </div>
                    {/* Decorative abstract shape */}
                    <div className="absolute right-[-10%] bottom-[-20%] text-[#d0d6ff] opacity-50 rotate-[-15deg]">
                      <SparklesIcon size={120} strokeWidth={1} />
                    </div>
                  </button>
                )}
                
                {/* Half Width Cards */}
                {categoryGrid[1] && (
                  <button
                    onClick={() => toggleFilter(categoryGrid[1])}
                    className="col-span-1 relative bg-[#fff4cf] rounded-2xl p-4 overflow-hidden text-left btn-active-state border border-transparent hover:border-[#ffe18a] transition-all min-h-[120px] flex flex-col justify-between will-change-transform"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#f59e0b] text-white flex items-center justify-center shadow-sm">
                      <UsersIcon size={14} />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-black text-[#745b00] leading-tight mb-0.5 line-clamp-1">{categoryGrid[1]}</h3>
                      <p className="text-[11px] text-[#a18627] font-medium">Trending</p>
                    </div>
                  </button>
                )}
                
                {categoryGrid[2] && (
                  <button
                    onClick={() => toggleFilter(categoryGrid[2])}
                    className="col-span-1 relative bg-[#f1edfc] rounded-2xl p-4 overflow-hidden text-left btn-active-state border border-transparent hover:border-[#dbcefc] transition-all min-h-[120px] flex flex-col justify-between will-change-transform"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#7c3aed] text-white flex items-center justify-center shadow-sm">
                      <CalendarIcon size={14} />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-black text-[#3d1880] leading-tight mb-0.5 line-clamp-1">{categoryGrid[2]}</h3>
                      <p className="text-[11px] text-[#6b4ab0] font-medium">Upcoming</p>
                    </div>
                  </button>
                )}

                {/* Clubs Card */}
                <Link
                  href="/clubs"
                  className="col-span-2 relative bg-[#ecfdf5] rounded-[28px] p-5 overflow-hidden text-left btn-active-state border border-transparent hover:border-[#a7f3d0] transition-all min-h-[100px] flex flex-col justify-center will-change-transform"
                >
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#059669] text-white flex items-center justify-center shadow-md">
                      <BuildingIcon size={20} />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-black text-[#064e3b] leading-tight">Clubs & Orgs</h3>
                      <p className="text-[12px] text-[#065f46] font-medium mt-0.5">Join a community today</p>
                    </div>
                    <div className="ml-auto">
                      <ArrowRightIcon size={20} className="text-[#059669]" />
                    </div>
                  </div>
                  {/* Decorative icon */}
                  <div className="absolute right-[-5%] top-[-10%] text-[#a7f3d0] opacity-30 rotate-[15deg]">
                    <BuildingIcon size={100} strokeWidth={1} />
                  </div>
                </Link>
              </div>
            </SectionContainer>
          )}

          {/* 5. All Upcoming Section - Vertical List */}
          {listWithoutSpotlight.length > 0 && (
            <SectionContainer title="All Upcoming" className="animate-fade-up" style={{ animationDelay: '250ms' }}>
              <div className="space-y-5">
                {displayedEvents.map((e) => (
                  <EventCard key={e.event_id} event={e} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-5 mt-6 flex flex-col items-center gap-4">
                  <p className="text-[12px] text-[var(--color-text-muted)] font-semibold">
                    Page <span className="text-[var(--color-primary)] font-bold">{currentPage}</span> of <span className="text-[var(--color-primary)] font-bold">{totalPages}</span>
                  </p>

                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const pageNum = i + 1;
                      const isCurrentPage = pageNum === currentPage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`transition-all btn-active-state ${
                            isCurrentPage
                              ? "w-8 h-2 rounded-full bg-[var(--color-primary)]"
                              : "w-2 h-2 rounded-full bg-[var(--color-border)] hover:bg-[var(--color-text-light)]"
                          }`}
                          aria-label={`Go to page ${pageNum}`}
                        />
                      );
                    })}
                    {totalPages > 5 && <span className="text-[var(--color-text-muted)] text-[11px] ml-1">•••</span>}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="btn-active-state"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="btn-active-state"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </SectionContainer>
          )}

          {/* Empty state */}
          {allFiltered.length === 0 && (
            <div className="px-5 py-12 animate-fade-in">
              <EmptyState
                icon={<SearchIcon size={32} className="text-[var(--color-primary)]" />}
                title="No events found"
                subtitle="Try adjusting your search or filters to see more results"
              />
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={() => { setActiveFilters(new Set(["Open"])); setSearch(""); }}>
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
