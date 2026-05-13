"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { SearchIcon, XIcon, UsersIcon, ArrowRightIcon, SparklesIcon } from "@/components/icons";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { useDebounce } from "@/lib/useDebounce";
import { supabase } from "@/lib/supabaseClient";

export interface ClubRecord {
  club_id: string;
  club_name: string;
  subtitle?: string | null;
  club_description?: string | null;
  club_web_link?: string | null;
  slug?: string | null;
  club_banner_url?: string | null;
  type?: "club" | "centre" | "cell" | null;
  category?: string | string[] | null;
  club_registrations?: boolean | null;
  club_roles_available?: string[] | null;
}

type TypeFilter = "all" | "club" | "centre" | "cell";

const TYPE_FILTERS: { label: string; value: TypeFilter; color: string }[] = [
  { label: "All", value: "all", color: "bg-[var(--color-primary)] text-white" },
  { label: "Clubs", value: "club", color: "bg-[#eef0ff] text-[#3b5bdb]" },
  { label: "Centres", value: "centre", color: "bg-[#fff4cf] text-[#b45309]" },
  { label: "Cells", value: "cell", color: "bg-[#f1edfc] text-[#7c3aed]" },
];

function toClubCategories(category: unknown): string[] {
  if (!category) return [];
  if (Array.isArray(category)) return category.map(String).filter(Boolean);
  if (typeof category === "string") {
    try {
      const parsed = JSON.parse(category);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
    return category.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function getTypeLabel(type: string | null | undefined) {
  if (type === "centre") return "Centre";
  if (type === "cell") return "Cell";
  return "Club";
}

function getTypeBadgeStyle(type: string | null | undefined) {
  if (type === "centre") return "bg-[#fff4cf] text-[#b45309]";
  if (type === "cell") return "bg-[#f1edfc] text-[#7c3aed]";
  return "bg-[#eef0ff] text-[#3b5bdb]";
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<ClubRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("clubs")
          .select("*")
          .order("club_name", { ascending: true });

        if (!error && data) {
          setClubs(data);
        }
      } catch (err) {
        console.error("Failed to fetch clubs:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const [hasLoadedMore, setHasLoadedMore] = useState(false);

  const filtered = useMemo(() => {
    let list = clubs;

    if (typeFilter !== "all") {
      list = list.filter((c) => c.type === typeFilter);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.club_name || "").toLowerCase().includes(q) ||
          (c.subtitle || "").toLowerCase().includes(q) ||
          (c.club_description || "").toLowerCase().includes(q) ||
          toClubCategories(c.category).some((cat) => cat.toLowerCase().includes(q))
      );
    }

    return list;
  }, [clubs, typeFilter, debouncedSearch]);

  // Reset state on filter change
  useEffect(() => {
    setHasLoadedMore(false);
  }, [typeFilter, debouncedSearch]);

  const pagedList = hasLoadedMore ? filtered : filtered.slice(0, 10);
  const openClubs = pagedList.filter((c) => c.club_registrations);
  const closedClubs = pagedList.filter((c) => !c.club_registrations);

  return (
    <div className="pwa-page pt-2 pb-24 bg-[#f9fafb] max-w-[420px] mx-auto">
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
                placeholder="Search clubs, centres, cells..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-[38px] pl-9 pr-8 text-[13px] bg-[#e8e9ec] border-none rounded-xl outline-none transition-all placeholder:text-[var(--color-text-muted)] font-medium"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] p-1 rounded-full hover:bg-black/5 z-[1]"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => { setIsSearchOpen(false); setSearch(""); }}
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

        {TYPE_FILTERS.map(({ label, value }) => {
          const active = typeFilter === value;
          return (
            <div key={value} className="snap-center shrink-0">
              <button
                type="button"
                onClick={() => setTypeFilter(value)}
                className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all whitespace-nowrap ${
                  active
                    ? "bg-[var(--color-accent)] text-[var(--color-primary-dark)] shadow-sm"
                    : "bg-[#f3f4f6] text-[var(--color-text-muted)] hover:bg-[#e5e7eb]"
                }`}
              >
                {label}
              </button>
            </div>
          );
        })}
        <div className="shrink-0 w-4 snap-end" aria-hidden />
      </div>

      {/* Content */}
      {loading ? (
        <div className="px-5 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 flex gap-3">
              <div className="skeleton w-[72px] h-[72px] rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-12">
          <EmptyState
            icon={<SparklesIcon size={32} className="text-[var(--color-primary)]" />}
            title="No organizations found"
            subtitle="Try adjusting your search or type filter"
          />
        </div>
      ) : (
        <div className="px-5 space-y-6 animate-fade-up">
          {/* Open registrations */}
          {openClubs.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-[18px] font-extrabold tracking-tight">Open Now</h2>
                <span className="bg-[#dcfce7] text-[#15803d] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {filtered.filter(c => c.club_registrations).length}
                </span>
              </div>
              <div className="space-y-3">
                {openClubs.map((club) => (
                  <ClubCard key={club.club_id} club={club} />
                ))}
              </div>
            </section>
          )}

          {/* Closed registrations */}
          {closedClubs.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-[18px] font-extrabold tracking-tight text-[var(--color-text-muted)]">
                  Applications Closed
                </h2>
                <span className="bg-[#f3f4f6] text-[var(--color-text-muted)] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {filtered.filter(c => !c.club_registrations).length}
                </span>
              </div>
              <div className="space-y-3">
                {closedClubs.map((club) => (
                  <ClubCard key={club.club_id} club={club} />
                ))}
              </div>
            </section>
          )}

          {/* Load More Button */}
          {!hasLoadedMore && filtered.length > 10 && (
            <div className="pt-4 pb-8 flex justify-center">
              <button
                onClick={() => setHasLoadedMore(true)}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-white border border-[var(--color-border)] text-[var(--color-primary)] text-[14px] font-black shadow-sm transition-all active:scale-95 hover:bg-[var(--color-primary-light)]"
              >
                Load More
                <ArrowRightIcon size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClubCard({ club }: { club: ClubRecord }) {
  const href = `/club/${club.slug || club.club_id}`;
  const categories = toClubCategories(club.category);

  return (
    <Link
      href={href}
      className="bg-white border border-[var(--color-border)] rounded-[28px] flex gap-3.5 p-4 shadow-sm btn-active-state will-change-transform group"
    >
      {/* Image */}
      <div className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-[var(--color-primary-light)] shrink-0 relative">
        {club.club_banner_url ? (
          <img
            src={club.club_banner_url}
            alt={club.club_name || "Club"}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-300 will-change-transform"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary-dark)] to-[var(--color-primary)] flex items-center justify-center">
            <span className="text-white font-black text-2xl opacity-50">
              {club.club_name?.[0]?.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold leading-tight line-clamp-1">{club.club_name}</p>
            {club.subtitle && (
              <p className="text-[12px] text-[var(--color-text-muted)] font-medium mt-0.5 line-clamp-1">
                {club.subtitle}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${getTypeBadgeStyle(club.type)}`}
          >
            {getTypeLabel(club.type)}
          </span>
        </div>

        {club.club_description && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
            {club.club_description}
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
          {categories.length > 0 && (
            <span className="text-[10px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-full">
              {categories[0]}
            </span>
          )}
          <span
            className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
              club.club_registrations
                ? "bg-[#dcfce7] text-[#15803d]"
                : "bg-[#fee2e2] text-[#dc2626]"
            }`}
          >
            {club.club_registrations ? "Open" : "Closed"}
          </span>
        </div>
      </div>
    </Link>
  );
}
