import { PWA_API_URL } from "@/lib/apiConfig";
import { Capacitor } from "@capacitor/core";

type ApiFetchOptions = RequestInit & {
  requireAuth?: boolean;
  retryOnAuthFailure?: boolean;
  timeoutMs?: number;
};

export class ApiError extends Error {
  status: number;
  code: string;
  url: string;
  method: string;
  responseBody: unknown;

  constructor(args: {
    message: string;
    status: number;
    code: string;
    url: string;
    method: string;
    responseBody: unknown;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.code = args.code;
    this.url = args.url;
    this.method = args.method;
    this.responseBody = args.responseBody;
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const clean = endpoint.trim();
  if (!clean) return "/";
  if (clean.startsWith("/api/")) return clean.slice(4);
  if (clean === "/api") return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function buildUrl(endpoint: string): string {
  const normalized = normalizeEndpoint(endpoint);
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `${trimTrailingSlash(PWA_API_URL)}${normalized}`;
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function parseBody(bodyText: string, contentType: string | null): unknown {
  if (!bodyText) return null;
  const isJson = Boolean(contentType && contentType.toLowerCase().includes("application/json"));
  if (!isJson) return bodyText;
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = (error.message || "").toLowerCase();
  return (
    error.name === "TimeoutError" ||
    message.includes("failed to fetch") ||
    message.includes("network")
  );
}

function shouldSetJsonContentType(body: BodyInit | null | undefined): boolean {
  if (!body) return false;
  if (typeof body === "string") return true;
  if (body instanceof URLSearchParams) return false;
  if (body instanceof FormData) return false;
  if (body instanceof Blob) return false;
  if (body instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(body)) return false;
  return true;
}

async function getSupabaseAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { supabase } = await import("@/lib/supabaseClient");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function refreshSupabaseAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { supabase } = await import("@/lib/supabaseClient");
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMs);

  const externalSignal = init.signal;
  let abortListener: (() => void) | null = null;

  if (externalSignal) {
    if (externalSignal.aborted) {
      timeoutController.abort();
    } else {
      abortListener = () => timeoutController.abort();
      externalSignal.addEventListener("abort", abortListener, { once: true });
    }
  }

  try {
    try {
      return await fetch(url, {
        ...init,
        signal: timeoutController.signal,
      });
    } catch (error) {
      if (timedOut && error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(`Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal && abortListener) {
      externalSignal.removeEventListener("abort", abortListener);
    }
  }
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    requireAuth = true,
    retryOnAuthFailure = true,
    timeoutMs = 10_000,
    ...requestInit
  } = options;

  const url = buildUrl(endpoint);
  const method = (requestInit.method || "GET").toUpperCase();

  if (Capacitor.isNativePlatform() && !url.startsWith("https://")) {
    throw new Error("API requests must use HTTPS on native platforms.");
  }

  let authRetried = false;
  let networkRetried = false;
  let token = requireAuth ? await getSupabaseAccessToken() : null;

  for (;;) {
    const headers = new Headers(requestInit.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (!headers.has("Content-Type") && shouldSetJsonContentType(requestInit.body)) {
      headers.set("Content-Type", "application/json");
    }
    if (requireAuth && token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    console.log("🔍 [NetworkDebug] Request", {
      url,
      method,
      headers: headersToObject(headers),
      tokenPresent: Boolean(headers.get("Authorization")),
      platform: Capacitor.getPlatform(),
      origin: typeof window !== "undefined" ? window.location.origin : "SSR",
    });

    try {
      const startedAt = Date.now();
      const response = await fetchWithTimeout(
        url,
        {
          ...requestInit,
          method,
          headers,
          mode: "cors",
          credentials: requestInit.credentials ?? "omit",
          referrerPolicy: requestInit.referrerPolicy ?? "no-referrer",
        },
        timeoutMs
      );
      const durationMs = Date.now() - startedAt;

      const rawBody = await response.text();
      const parsedBody = parseBody(rawBody, response.headers.get("content-type"));

      console.log("🔍 [NetworkDebug] Response", {
        url,
        method,
        status: response.status,
        durationMs,
        body: parsedBody,
      });

      if (response.status === 401 && requireAuth && retryOnAuthFailure && !authRetried) {
        const refreshed = await refreshSupabaseAccessToken();
        if (refreshed) {
          token = refreshed;
          authRetried = true;
          console.warn("🔍 [NetworkDebug] Retrying after token refresh", { url, method });
          continue;
        }
      }

      if (!response.ok) {
        const message =
          typeof parsedBody === "string"
            ? parsedBody
            : (parsedBody as any)?.error || `Request failed with status ${response.status}`;
        throw new ApiError({
          message,
          status: response.status,
          code: "API_ERROR",
          url,
          method,
          responseBody: parsedBody,
        });
      }

      return parsedBody as T;
    } catch (error) {
      console.error("🔍 [NetworkDebug] FetchError", {
        url,
        method,
        error: error instanceof Error ? error.message : String(error),
      });

      if (isNetworkFailure(error) && !networkRetried) {
        networkRetried = true;
        console.warn("🔍 [NetworkDebug] Retrying after network failure", { url, method });
        continue;
      }

      if (error instanceof Error && error.name === "TimeoutError") throw error;
      throw error;
    }
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  return apiFetch<T>(endpoint, options);
}
