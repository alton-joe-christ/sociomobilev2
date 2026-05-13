"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPinIcon, RefreshCwIcon, CopyIcon, CheckIcon } from "@/components/icons";
import { MicroLoader } from "@/components/loading";
import { apiRequest } from "@/lib/apiClient";

/* ── Christ University campus coordinates (match web) ── */
const CAMPUSES = [
  { name: "Central Campus (Main)", lat: 12.93611753346996, lng: 77.60604219692418 },
  { name: "Bannerghatta Road Campus", lat: 12.878129156102318, lng: 77.59588398930113 },
  { name: "Yeshwanthpur Campus", lat: 13.037196562241775, lng: 77.5069922916129 },
  { name: "Kengeri Campus", lat: 12.869504452408306, lng: 77.43640503831412 },
  { name: "Delhi NCR Campus", lat: 28.86394683554733, lng: 77.35636918532354 },
  { name: "Pune Lavasa Campus", lat: 18.6221158344556, lng: 73.48047100149613 },
] as const;

const MAX_CAMPUS_DISTANCE_KM = 15;
const DISMISS_KEY = "campus_modal_dismissed_at";
const DISMISS_HOURS = 12;

/* ── Haversine distance (km) ── */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type ModalState = "detecting" | "confirm" | "finalConfirm" | "notOnCampus" | "saving" | "success" | "error";

export function isCampusDismissedRecently(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    const elapsed = Date.now() - Number(ts);
    return elapsed < DISMISS_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

interface CampusSelectorProps {
  email: string;
  onComplete: (campus: string) => void;
  onDismiss: () => void;
}

export default function CampusSelector({ email, onComplete, onDismiss }: CampusSelectorProps) {
  const [state, setState] = useState<ModalState>("detecting");
  const [detectedCampus, setDetectedCampus] = useState<string | null>(null);
  const [detectedDistance, setDetectedDistance] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [copied, setCopied] = useState(false);

  const handleDismiss = () => {
    markDismissed();
    onDismiss();
  };

  const detectLocation = useCallback(() => {
    setState("detecting");
    setConfirmInput("");
    setCopied(false);

    if (!navigator.geolocation) {
      setState("notOnCampus");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        let nearest = CAMPUSES[0] as (typeof CAMPUSES)[number];
        let minDist = Infinity;
        for (const c of CAMPUSES) {
          const d = haversine(latitude, longitude, c.lat, c.lng);
          if (d < minDist) {
            minDist = d;
            nearest = c;
          }
        }

        setDetectedCampus(nearest.name);
        setDetectedDistance(Math.round(minDist * 10) / 10);

        if (minDist <= MAX_CAMPUS_DISTANCE_KM) {
          setState("confirm");
        } else {
          setState("notOnCampus");
        }
      },
      () => {
        setState("notOnCampus");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const saveCampus = async (campus: string) => {
    setState("saving");
    try {
      await apiRequest(`/users/${encodeURIComponent(email)}/campus`, {
        method: "PUT",
        body: JSON.stringify({ campus }),
      });
      setState("success");
      setTimeout(() => onComplete(campus), 900);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
      setState("error");
    }
  };

  const copyYes = async () => {
    try {
      await navigator.clipboard.writeText("YES");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="px-5 pt-5 pb-2 text-center border-b border-[var(--color-border)]">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
            <MapPinIcon size={24} className="text-[var(--color-primary)]" />
          </div>
          <h2 className="text-lg font-extrabold">
            {state === "finalConfirm" ? "Final Confirmation" : "Set Your Campus"}
          </h2>
        </div>

        <div className="px-5 pb-5">
          {state === "detecting" && (
            <div className="flex flex-col items-center py-6">
              <MicroLoader size={36} tone="primary" className="mb-3" />
              <p className="text-[13px] text-[var(--color-text-muted)] text-center font-medium">
                Detecting your location...
              </p>
              <p className="text-[11px] text-[var(--color-text-light)] mt-1 text-center">
                Please allow location access when prompted
              </p>
            </div>
          )}

          {state === "confirm" && detectedCampus && (
            <>
              <div className="text-center mb-4 mt-4">
                <p className="text-lg font-bold text-[var(--color-primary-dark)]">{detectedCampus}</p>
                <p className="text-xs font-semibold text-[var(--color-primary)] mt-0.5">{detectedDistance} km away</p>
              </div>

              <p className="text-sm text-[var(--color-text-muted)] text-center mb-4">
                This is <strong>permanent</strong> and cannot be changed. Wrong campus? Dismiss and retry on your campus network.
              </p>

              <button
                onClick={() => setState("finalConfirm")}
                className="btn btn-primary w-full"
              >
                Yes, This Is My Campus
              </button>
              <button
                onClick={handleDismiss}
                className="btn btn-ghost w-full mt-2"
              >
                Wrong Campus — Try Later On Campus
              </button>
            </>
          )}

          {state === "finalConfirm" && detectedCampus && (
            <>
              <div className="text-center mb-4 mt-4">
                <p className="text-base font-bold text-[var(--color-primary-dark)] mb-1">Your campus will be set to</p>
                <p className="text-xl font-extrabold text-[var(--color-primary)] mb-2">{detectedCampus.toUpperCase()}</p>
                <p className="text-sm font-semibold text-red-600">This is permanent. Are you sure?</p>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                  Type <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[var(--color-primary)]">YES</span> to confirm:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="YES"
                    className="input flex-1 text-center text-base font-bold tracking-widest uppercase"
                    autoFocus
                  />
                  <button
                    onClick={copyYes}
                    className="btn btn-ghost px-3 shrink-0"
                    title="Copy YES to clipboard"
                    type="button"
                  >
                    {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <button
                onClick={() => saveCampus(detectedCampus)}
                disabled={confirmInput.trim().toUpperCase() !== "YES"}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm &amp; Save
              </button>
              <button
                onClick={() => {
                  setConfirmInput("");
                  setState("confirm");
                }}
                className="btn btn-ghost w-full mt-2 text-[12px]"
              >
                Go Back
              </button>
            </>
          )}

          {state === "notOnCampus" && (
            <>
              <div className="text-center mb-4 mt-5">
                <MapPinIcon size={30} className="mx-auto text-[var(--color-text-light)] mb-2" />
                <p className="text-[var(--color-text)] font-semibold text-sm">Not on campus</p>
                <p className="text-[var(--color-text-light)] text-xs mt-1">
                  Try again when on your campus network. You can use <strong>Detect Campus</strong> on your profile anytime.
                </p>
              </div>

              <button
                onClick={handleDismiss}
                className="btn btn-primary w-full"
              >
                Got It
              </button>
            </>
          )}

          {state === "saving" && (
            <div className="flex flex-col items-center py-6">
              <MicroLoader size={36} tone="primary" className="mb-3" />
              <p className="text-[14px] font-semibold text-center">Saving your campus...</p>
            </div>
          )}

          {state === "success" && detectedCampus && (
            <div className="flex flex-col items-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-[15px] font-bold text-center">{detectedCampus}</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-1">Saved successfully</p>
            </div>
          )}

          {state === "error" && (
            <div className="py-4">
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center mb-3">
                <p className="font-semibold text-red-700 text-sm">Something went wrong</p>
                <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
              </div>
              <button onClick={detectLocation} className="btn btn-primary w-full">
                <RefreshCwIcon size={16} /> Try Again
              </button>
              <button
                onClick={handleDismiss}
                className="btn btn-ghost w-full mt-2 text-[12px]"
              >
                Try again later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
