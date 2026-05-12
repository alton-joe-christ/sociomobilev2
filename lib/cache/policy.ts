export const CACHE_OWNERSHIP = {
  valkey: "Authoritative backend read cache",
  swr: "Frontend UI freshness layer",
  apiClientMemory: "Micro-latency optimization only",
  serviceWorker: "Offline/static asset acceleration only",
} as const;

export const CLIENT_CACHE_TTL_MS = {
  apiMemory: 10_000,
} as const;

export const SWR_DEDUPING_MS = {
  hotRead: 15_000,
  shortRead: 10_000,
  registrationRead: 15_000,
} as const;

export const VALKEY_TTL_SECONDS = {
  homepageEvents: 90,
  discoverFeed: 90,
  eventDetails: 90,
  festListings: 120,
  festDetails: 120,
  catering: 30,
  notificationSummary: 30,
  volunteerEventList: 20,
  volunteerAccessValidation: 10,
} as const;

export const NEVER_CACHE_DOMAINS = [
  "attendance writes",
  "qr verification mutations",
  "auth/session validation",
  "jwt handling",
  "role mutations",
  "permission mutations",
  "scanner verification",
  "attendance authorization",
] as const;

export type EndpointCategory =
  | "hot-cache"
  | "short-lived"
  | "very-short-or-bypass"
  | "never-cache";

export interface EndpointCachePolicy {
  id: string;
  category: EndpointCategory;
  endpointPatterns: string[];
  backendValkeyTtlSeconds: number | null;
  frontendSWRDedupingMs: number | null;
  frontendMemoryCacheMs: number;
  serviceWorkerBehavior: "network-only" | "static-offline-only";
  backendExpectation: string;
}

export const CACHE_POLICY_MATRIX: EndpointCachePolicy[] = [
  {
    id: "homepage-events",
    category: "hot-cache",
    endpointPatterns: ["/events", "/discover"],
    backendValkeyTtlSeconds: VALKEY_TTL_SECONDS.homepageEvents,
    frontendSWRDedupingMs: SWR_DEDUPING_MS.hotRead,
    frontendMemoryCacheMs: CLIENT_CACHE_TTL_MS.apiMemory,
    serviceWorkerBehavior: "network-only",
    backendExpectation: "Valkey authoritative with SWR-style revalidation.",
  },
  {
    id: "event-details",
    category: "hot-cache",
    endpointPatterns: ["/events/:eventId"],
    backendValkeyTtlSeconds: VALKEY_TTL_SECONDS.eventDetails,
    frontendSWRDedupingMs: SWR_DEDUPING_MS.hotRead,
    frontendMemoryCacheMs: CLIENT_CACHE_TTL_MS.apiMemory,
    serviceWorkerBehavior: "network-only",
    backendExpectation: "Valkey authoritative; invalidate on event mutations.",
  },
  {
    id: "fests",
    category: "hot-cache",
    endpointPatterns: ["/fests", "/fests/:festId"],
    backendValkeyTtlSeconds: VALKEY_TTL_SECONDS.festListings,
    frontendSWRDedupingMs: SWR_DEDUPING_MS.hotRead,
    frontendMemoryCacheMs: CLIENT_CACHE_TTL_MS.apiMemory,
    serviceWorkerBehavior: "network-only",
    backendExpectation: "Valkey authoritative; invalidate on fest mutations.",
  },
  {
    id: "catering",
    category: "short-lived",
    endpointPatterns: ["/catering/*"],
    backendValkeyTtlSeconds: VALKEY_TTL_SECONDS.catering,
    frontendSWRDedupingMs: SWR_DEDUPING_MS.shortRead,
    frontendMemoryCacheMs: CLIENT_CACHE_TTL_MS.apiMemory,
    serviceWorkerBehavior: "network-only",
    backendExpectation: "Short TTL with strict invalidation after vendor/menu updates.",
  },
  {
    id: "notifications-summary",
    category: "short-lived",
    endpointPatterns: ["/notifications*"],
    backendValkeyTtlSeconds: VALKEY_TTL_SECONDS.notificationSummary,
    frontendSWRDedupingMs: SWR_DEDUPING_MS.shortRead,
    frontendMemoryCacheMs: CLIENT_CACHE_TTL_MS.apiMemory,
    serviceWorkerBehavior: "network-only",
    backendExpectation: "Read summary cache only; writes invalidate immediately.",
  },
  {
    id: "volunteer-sensitive",
    category: "very-short-or-bypass",
    endpointPatterns: ["/volunteer/*"],
    backendValkeyTtlSeconds: VALKEY_TTL_SECONDS.volunteerAccessValidation,
    frontendSWRDedupingMs: null,
    frontendMemoryCacheMs: 0,
    serviceWorkerBehavior: "network-only",
    backendExpectation: "Bypass or ultra-short cache only for non-authoritative read views.",
  },
  {
    id: "scanner-auth-never-cache",
    category: "never-cache",
    endpointPatterns: ["/scan-qr", "/register", "/users/me", "/auth/*", "/roles/*", "/permissions/*"],
    backendValkeyTtlSeconds: null,
    frontendSWRDedupingMs: null,
    frontendMemoryCacheMs: 0,
    serviceWorkerBehavior: "network-only",
    backendExpectation: "Always authoritative backend truth. No cache writes.",
  },
];

const CLIENT_MEMORY_BYPASS_PATTERNS = [
  "/scan-qr",
  "/volunteer/",
  "/users/me",
  "/auth/",
  "/register",
  "/roles/",
  "/permissions/",
];

export function normalizeEndpointPath(endpoint: string): string {
  const raw = endpoint.trim();
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      return `${url.pathname}${url.search}`.toLowerCase();
    }
  } catch {
    // Ignore URL parse errors and fall through to string normalization.
  }
  return raw.toLowerCase();
}

export function shouldBypassClientMemoryCache(
  endpoint: string,
  method: string,
  requestCacheMode?: RequestCache
): boolean {
  if (method.toUpperCase() !== "GET") return true;
  if (requestCacheMode === "no-store") return true;

  const normalized = normalizeEndpointPath(endpoint);
  return CLIENT_MEMORY_BYPASS_PATTERNS.some((pattern) => normalized.includes(pattern));
}
