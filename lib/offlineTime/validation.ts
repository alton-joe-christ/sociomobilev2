/**
 * Offline Validation (Phases 3, 4, 8, 9, 11)
 * ────────────────────────────────────────────────────────────
 * Pure validators that decide whether an attendance scan should be
 * accepted offline. These do NOT call the network — the server is
 * always the final authority during reconciliation (Phase 7).
 *
 * Tolerances:
 *   - ±5 minutes on event window and assignment expiry by default,
 *     to absorb tiny device drift and avoid false rejections at the
 *     hard boundaries (Phase 8).
 *
 * UX strings are short, human, and free of technical jargon (Phase 11).
 */

import type { VolunteerEvent } from "@/context/AuthContext";
import {
  getVolunteerEventEndDate,
} from "@/lib/volunteerAccess";
import { logTimeAudit } from "./audit";
import { getTimeIntegrityReport } from "./integrity";
import type { TimeIntegrityLevel, TimeIntegrityReport } from "./types";

/** Drift tolerance in milliseconds (Phase 8). */
export const DEFAULT_DRIFT_TOLERANCE_MS = 5 * 60_000;

export type OfflineDecision =
  | { allow: true; reason: "ok"; integrity: TimeIntegrityReport }
  | { allow: false; reason: OfflineRejectReason; message: string; integrity: TimeIntegrityReport };

export type OfflineRejectReason =
  | "no-trusted-time"
  | "time-compromised"
  | "anchor-expired"
  | "event-not-started"
  | "event-window-closed"
  | "assignment-expired"
  | "assignment-missing";

interface DecideOptions {
  /** Override drift tolerance — useful for testing or very long events. */
  driftToleranceMs?: number;
  /** Pre-computed integrity report to avoid re-sampling (optional). */
  integrity?: TimeIntegrityReport;
}

function parseEventStart(event: VolunteerEvent): Date | null {
  // event_date is yyyy-mm-dd; event_time is HH:MM[:SS] in campus tz.
  // We piggyback on the same logic used in volunteerAccess for end-date
  // by treating start as "use start fields" — the helper there only
  // exports the end-date variant so we inline a minimal parse here.
  const dateValue = event.event_date;
  const timeValue = event.event_time ?? "00:00";
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || "").trim());
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(
    String(timeValue || "").trim(),
  );
  if (!dateMatch || !timeMatch) return null;
  const [, y, m, d] = dateMatch.map(Number);
  const [, hh, mm, ss = "0"] = timeMatch;
  // Campus is IST (+05:30). 330 = 5*60 + 30.
  const utcMs =
    Date.UTC(y, m - 1, d, Number(hh), Number(mm), Number(ss)) - 330 * 60_000;
  const parsed = new Date(utcMs);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function blockFor(
  reason: OfflineRejectReason,
  message: string,
  integrity: TimeIntegrityReport,
): OfflineDecision {
  return { allow: false, reason, message, integrity };
}

/**
 * Decide whether a scan should be allowed RIGHT NOW for the given event.
 * Server reconciliation is still authoritative — this gate just keeps
 * obviously-invalid scans from being captured or queued.
 */
export function decideOfflineScan(
  event: VolunteerEvent,
  options: DecideOptions = {},
): OfflineDecision {
  const integrity = options.integrity ?? getTimeIntegrityReport();
  const tolerance = options.driftToleranceMs ?? DEFAULT_DRIFT_TOLERANCE_MS;
  const nowMs = integrity.trustedNowMs;

  // Hard blocks from time-integrity layer.
  if (integrity.level === "compromised") {
    return blockFor(
      "time-compromised",
      "Scanner needs quick reconnect",
      integrity,
    );
  }
  if (integrity.level === "no-anchor") {
    return blockFor(
      "no-trusted-time",
      "Scanner needs quick reconnect",
      integrity,
    );
  }
  if (integrity.level === "expired-anchor") {
    return blockFor(
      "anchor-expired",
      "Reconnect briefly to refresh secure verification",
      integrity,
    );
  }

  // Assignment expiry (Phase 4).
  const assignmentExpiryRaw = event.volunteer_assignment?.expires_at;
  if (!assignmentExpiryRaw) {
    return blockFor(
      "assignment-missing",
      "You are not assigned to this event.",
      integrity,
    );
  }
  const assignmentExpiryMs = new Date(assignmentExpiryRaw).getTime();
  if (!Number.isFinite(assignmentExpiryMs)) {
    return blockFor(
      "assignment-missing",
      "You are not assigned to this event.",
      integrity,
    );
  }
  if (nowMs - tolerance >= assignmentExpiryMs) {
    logTimeAudit("validation.assignment-expired", {
      nowMs,
      assignmentExpiryMs,
      tolerance,
    });
    return blockFor(
      "assignment-expired",
      "Volunteer assignment expired.",
      integrity,
    );
  }

  // Event window (Phase 3).
  const start = parseEventStart(event);
  const end = getVolunteerEventEndDate(event);

  if (start && nowMs + tolerance < start.getTime()) {
    return blockFor(
      "event-not-started",
      "Attendance window not open yet.",
      integrity,
    );
  }
  if (end && nowMs - tolerance >= end.getTime()) {
    logTimeAudit("validation.event-window-closed", {
      nowMs,
      endMs: end.getTime(),
      tolerance,
    });
    return blockFor(
      "event-window-closed",
      "Attendance window closed.",
      integrity,
    );
  }

  return { allow: true, reason: "ok", integrity };
}

/** UX label for the current integrity level — short and non-technical (Phase 11). */
export function integrityLabel(level: TimeIntegrityLevel): string {
  switch (level) {
    case "trusted":
      return "Offline verification active";
    case "drift-warning":
      return "Sync recommended soon";
    case "stale-anchor":
      return "Offline • Secure sync pending";
    case "expired-anchor":
      return "Reconnect required";
    case "compromised":
      return "Scanner needs quick reconnect";
    case "no-anchor":
      return "";
    default:
      return "";
  }
}
