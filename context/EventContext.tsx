"use client";

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react";
import { apiRequest } from "@/lib/apiClient";

/* ── Types ── */
export interface FetchedEvent {
  event_id: string;
  title: string;
  description: string;
  event_date: string;
  end_date: string | null;
  event_time: string | null;
  venue: string;
  category: string | null;
  registration_fee: number | null;
  participants_per_team: number;
  max_participants: number | null;
  total_participants: number | null;
  event_image_url: string | null;
  banner_url: string | null;
  pdf_url: string | null;
  rules: any;
  schedule: any;
  prizes: any;
  organizer_email: string;
  organizer_phone: string | number | null;
  whatsapp_invite_link: string | null;
  organizing_dept: string | null;
  department_access: any;
  fest: string | null;
  created_by: string | null;
  registration_deadline: string | null;
  allow_outsiders: boolean;
  outsider_registration_fee: number | null;
  outsider_max_participants: number | null;
  custom_fields: any;
  claims_applicable: boolean;
  campus_hosted_at?: string | null;
  allowed_campuses?: string[] | string | null;
  is_archived?: boolean | null;
  is_draft?: boolean | null;
}

export interface Fest {
  id: string | number;
  fest_id: string;
  slug: string;
  fest_title: string;
  description: string;
  opening_date: string;
  closing_date: string;
  fest_image_url: string | null;
  organizing_dept: string | null;
  category: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  event_heads: any;
  venue?: string | null;
  status?: string | null;
  sponsors?: any;
  guests?: any;
  highlights?: any;
  faqs?: any;
  banner_url?: string | null;
  campus_hosted_at?: string | null;
  allowed_campuses?: string[] | string | null;
  // aliases used by components
  name?: string;
  image_url?: string | null;
  start_date?: string;
  end_date?: string;
  department?: string | null;
}

/* ── Campus Availability Logic ── */

export interface CampusScopedItem {
  campus_hosted_at?: string | null;
  allowed_campuses?: string[] | string | null;
  venue?: string | null;
  allow_outsiders?: boolean | null;
}

const normalizeCampusText = (value: string | null | undefined): string => {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

const CAMPUS_ALIASES: Record<string, string[]> = {
  "central campus main": ["central campus main", "central campus", "main campus", "central"],
  "bannerghatta road campus": ["bannerghatta road campus", "bannerghatta", "bg road"],
  "yeshwanthpur campus": ["yeshwanthpur campus", "yeshwanthpur"],
  "kengeri campus": ["kengeri campus", "kengeri"],
  "delhi ncr campus": ["delhi ncr campus", "delhi ncr", "delhi"],
  "pune lavasa campus": ["pune lavasa campus", "pune lavasa", "lavasa", "pune"],
};

const getCampusMatchers = (selectedCampus: string): string[] => {
  const normalizedCampus = normalizeCampusText(selectedCampus);
  const aliases = CAMPUS_ALIASES[normalizedCampus] || [selectedCampus];
  return Array.from(
    new Set(aliases.map((entry) => normalizeCampusText(entry)).filter(Boolean))
  );
};

const parseCampusField = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === "string");
      }
    } catch {
      return [trimmed];
    }
    return [];
  }
  return [];
};

const matchesCampusText = (value: string | null | undefined, matchers: string[]): boolean => {
  const normalizedValue = normalizeCampusText(value);
  if (!normalizedValue) return false;
  return matchers.some(
    (matcher) =>
      normalizedValue === matcher ||
      normalizedValue.includes(matcher) ||
      matcher.includes(normalizedValue)
  );
};

export const matchesSelectedCampus = (
  item: CampusScopedItem,
  selectedCampus: string
): boolean => {
  if (!selectedCampus) return true;
  const campusMatchers = getCampusMatchers(selectedCampus);
  if (campusMatchers.length === 0) return true;
  const allowedCampuses = parseCampusField(item.allowed_campuses);
  const hasCampusData = Boolean(normalizeCampusText(item.campus_hosted_at)) || allowedCampuses.length > 0;
  if (!hasCampusData) return true;
  if (matchesCampusText(item.campus_hosted_at, campusMatchers)) return true;
  if (allowedCampuses.some((campus) => matchesCampusText(campus, campusMatchers))) return true;
  return false;
};

interface EventCtx {
  allEvents: FetchedEvent[];
  isLoading: boolean;
  error: string | null;
  refreshEvents: () => Promise<void>;
}

const EventContext = createContext<EventCtx>({
  allEvents: [],
  isLoading: false,
  error: null,
  refreshEvents: async () => {},
});

export const useEvents = () => useContext(EventContext);

export function EventProvider({
  initialEvents = [],
  children,
}: {
  initialEvents?: FetchedEvent[];
  children: ReactNode;
}) {
  const [allEvents, setAllEvents] = useState<FetchedEvent[]>(initialEvents);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data: any = await apiRequest(`/events`, { cache: "no-store" });
      const events = data.events ?? data.data ?? data ?? [];
      setAllEvents(Array.isArray(events) ? events : []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch events");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch events on mount if we have none (e.g. static export fallback)
  useEffect(() => {
    if (allEvents.length === 0) {
      void refreshEvents();
    }
  }, [allEvents.length, refreshEvents]);

  return (
    <EventContext.Provider value={{ allEvents, isLoading, error, refreshEvents }}>
      {children}
    </EventContext.Provider>
  );
}
