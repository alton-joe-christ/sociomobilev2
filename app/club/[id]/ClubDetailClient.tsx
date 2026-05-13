"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeftIcon, GlobeIcon, CheckCircleIcon, XIcon, ArrowRightIcon } from "@/components/icons";
import toast from "react-hot-toast";
import { sanitizeUrl } from "@/lib/sanitizeUrl";

interface ClubRecord {
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
  clubs_applicants?: unknown;
  clubs_applicant?: unknown;
}

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

function normalizeRoleOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const options: string[] = [];
  for (const item of value) {
    const role = String(item ?? "").trim();
    if (!role) continue;
    const key = role.toLowerCase();
    if (key === "member" || seen.has(key)) continue;
    seen.add(key);
    options.push(role);
  }
  return options;
}

function parseClubApplicants(value: unknown): Array<{ regno?: string; email?: string }> {
  const parsed =
    typeof value === "string"
      ? (() => { try { return JSON.parse(value); } catch { return []; } })()
      : value;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") return [parsed as any];
  return [];
}

function getTypeLabel(type: string | null | undefined) {
  if (type === "centre") return "Centre";
  if (type === "cell") return "Cell";
  return "Club";
}

export default function ClubDetailClient({ id }: { id: string }) {
  const { userData, session } = useAuth();

  const [club, setClub] = useState<ClubRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentEmail = String(userData?.email || session?.user?.email || "").trim().toLowerCase();
  const registerNumber = String(userData?.register_number ?? "").trim();

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let isMounted = true;

    (async () => {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        
        let query = supabase.from("clubs").select("*");
        if (isUuid) {
          query = query.or(`slug.eq.${id},club_id.eq.${id}`);
        } else {
          query = query.eq("slug", id);
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;
        if (isMounted) setClub(data ?? null);
      } catch (e: any) {
        if (isMounted) setError(e.message || "Failed to load club");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="pwa-page pt-2 pb-8 max-w-[420px] mx-auto">
        <div className="animate-pulse">
          <div className="skeleton h-[240px] w-full" />
          <div className="px-5 py-5 space-y-3">
            <div className="skeleton h-6 w-2/3" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-20 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="pwa-page pt-2 pb-8 max-w-[420px] mx-auto px-5 flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-[var(--color-text-muted)] font-semibold text-center">
          {error || "Club not found"}
        </p>
        <Link href="/clubs" className="mt-4 btn btn-primary btn-sm">
          Back to Clubs
        </Link>
      </div>
    );
  }

  const categories = toClubCategories(club.category);
  const entityLabel = getTypeLabel(club.type);
  const availableRoles = normalizeRoleOptions(club.club_roles_available);
  const clubApplicants = parseClubApplicants(club.clubs_applicants ?? club.clubs_applicant);
  const normalizedRegno = registerNumber.trim().toUpperCase();

  const isAlreadyApplicant =
    Boolean(currentEmail) &&
    clubApplicants.some((entry) => {
      const entryEmail = String(entry?.email ?? "").trim().toLowerCase();
      const entryRegno = String(entry?.regno ?? "").trim().toUpperCase();
      if (currentEmail && entryEmail === currentEmail) return true;
      if (normalizedRegno && entryRegno === normalizedRegno) return true;
      return false;
    });

  const handleJoinClick = () => {
    if (!currentEmail) {
      toast.error("Please sign in to apply for this club.");
      return;
    }
    if (!club.club_registrations) {
      toast.error("Registrations are currently closed.");
      return;
    }
    if (isAlreadyApplicant) {
      toast.error("You have already applied to this club.");
      return;
    }
    if (availableRoles.length === 0) {
      toast.error("No roles are currently available for this club.");
      return;
    }
    if (!registerNumber) {
      toast.error("Register number is missing from your profile.");
      return;
    }
    if (registerNumber.toUpperCase().startsWith("VIS")) {
      toast.error("Please login through your university email to apply.");
      return;
    }
    setSelectedRole("");
    setIsApplyModalOpen(true);
  };

  const handleApplySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRole) {
      toast.error("Please select a role to apply.");
      return;
    }
    if (!session?.access_token) {
      toast.error("Please sign in again and retry.");
      return;
    }

    setIsSubmitting(true);
    try {
      const existingApplicants = parseClubApplicants(club.clubs_applicants ?? club.clubs_applicant);
      const newApplicant = {
        regno: normalizedRegno,
        name: userData?.name ?? "",
        email: currentEmail,
        role_applied_for: selectedRole,
        applied_at: new Date().toISOString(),
      };
      const updatedApplicants = [...existingApplicants, newApplicant];

      const { error: updateError } = await supabase
        .from("clubs")
        .update({
          clubs_applicants: updatedApplicants,
          clubs_applicant: updatedApplicants,
        })
        .eq("club_id", club.club_id);

      if (updateError) throw updateError;

      setClub((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          clubs_applicants: updatedApplicants,
          clubs_applicant: updatedApplicants,
        };
      });

      toast.success("Application submitted successfully! 🎉");
      setIsApplyModalOpen(false);
    } catch (err: any) {
      console.error("Apply Error:", err);
      toast.error(err.message || "Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pwa-page pt-2 pb-24 bg-[#f9fafb] max-w-[420px] mx-auto">
      {/* Banner */}
      <div className="px-5 pt-4">
        <div className="relative h-[240px] w-full overflow-hidden rounded-[28px] bg-[var(--color-primary-dark)] shadow-lg">
          {club.club_banner_url ? (
            <img
              src={club.club_banner_url}
              alt={club.club_name || "Club"}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary-dark)] to-[var(--color-primary)] flex items-center justify-center">
              <span className="text-white font-black text-6xl opacity-20">
                {club.club_name?.[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {categories[0] && (
            <span className="absolute top-4 left-4 bg-[var(--color-accent)] text-[var(--color-primary-dark)] text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
              {categories[0]}
            </span>
          )}

          <div className="absolute bottom-4 left-5 right-5">
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
              {entityLabel}
            </span>
            <h1 className="text-[26px] font-black text-white leading-tight mt-1 drop-shadow-md">
              {club.club_name}
            </h1>
            {club.subtitle && (
              <p className="text-[13px] text-white/80 font-medium mt-0.5">{club.subtitle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-8">
        <div className="bg-white border border-[var(--color-border)] rounded-[32px] p-5 flex items-center justify-between gap-4 shadow-sm">
          <div>
            <p className="text-[11px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest">
              Registrations
            </p>
            <p className={`text-[16px] font-black mt-0.5 ${club.club_registrations ? "text-[#15803d]" : "text-[#dc2626]"}`}>
              {club.club_registrations ? "Open" : "Closed"}
            </p>
          </div>

          {club.club_registrations ? (
            <button
              onClick={handleJoinClick}
              disabled={isAlreadyApplicant}
              className={`h-11 px-6 rounded-full shrink-0 text-[13px] font-black transition-all active:scale-95 flex items-center gap-2 ${
                isAlreadyApplicant 
                  ? "bg-[#dcfce7] text-[#15803d] border border-[#86efac] cursor-default" 
                  : "bg-[var(--color-accent)] text-[var(--color-primary-dark)] shadow-[0_4px_12px_rgba(255,224,139,0.4)]"
              }`}
            >
              {isAlreadyApplicant ? (
                <>
                  <CheckCircleIcon size={16} />
                  Applied
                </>
              ) : (
                <>
                  Apply Now
                  <ArrowRightIcon size={16} />
                </>
              )}
            </button>
          ) : (
            <span className="text-[12px] font-bold text-[#dc2626] bg-[#fee2e2] px-4 py-2 rounded-full">
              Closed
            </span>
          )}
        </div>

        {club.club_description && (
          <div>
            <h2 className="text-[18px] font-black tracking-tight mb-2">About</h2>
            <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">{club.club_description}</p>
          </div>
        )}

        {categories.length > 0 && (
          <div>
            <h2 className="text-[18px] font-black tracking-tight mb-3">Categories</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <span key={cat} className="text-[12px] font-bold bg-[var(--color-primary-light)] text-[var(--color-primary)] px-3.5 py-1.5 rounded-full">{cat}</span>
              ))}
            </div>
          </div>
        )}

        {availableRoles.length > 0 && (
          <div>
            <h2 className="text-[18px] font-black tracking-tight mb-3">Open Roles</h2>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((role) => (
                <span key={role} className="text-[12px] font-bold border border-[var(--color-border)] text-[var(--color-text)] px-3.5 py-1.5 rounded-full">{role}</span>
              ))}
            </div>
          </div>
        )}

        {club.club_web_link && (
          <a
            href={club.club_web_link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost w-full flex items-center justify-center gap-2 text-[13px]"
          >
            <GlobeIcon size={15} /> Visit Official Website
          </a>
        )}
      </div>

      {isApplyModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => { if (!isSubmitting) setIsApplyModalOpen(false); }}
        >
          <div className="w-full max-w-[420px] bg-white rounded-t-[28px] sm:rounded-[24px] shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
              <div>
                <h3 className="text-[17px] font-black">Apply to {club.club_name}</h3>
                <p className="text-[12px] text-[var(--color-text-muted)] font-medium mt-0.5">Select a role to apply for</p>
              </div>
              <button type="button" onClick={() => setIsApplyModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f3f4f6] text-[var(--color-text-muted)]"><XIcon size={16} /></button>
            </div>
            <form onSubmit={handleApplySubmit} className="px-5 pt-4 pb-[calc(var(--bottom-nav)+var(--safe-bottom)+24px)] space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-1 block">Register Number</label>
                <input value={registerNumber} disabled readOnly className="input bg-[#f8f9fa] text-[var(--color-text)] font-semibold text-[13px]" />
              </div>
              <div>
                <label htmlFor="role-select" className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-1 block">Role</label>
                <select id="role-select" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} required className="input select text-[13px] font-medium">
                  <option value="">Select a role</option>
                  {availableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div className="bg-[#f8faff] rounded-xl border border-[var(--color-border)] p-3 text-[12px] space-y-1">
                <p><span className="font-bold text-[var(--color-primary)]">Name: </span>{userData?.name || "Not available"}</p>
                <p className="break-all"><span className="font-bold text-[var(--color-primary)]">Email: </span>{currentEmail || "Not available"}</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIsApplyModalOpen(false)} disabled={isSubmitting} className="btn btn-ghost btn-sm flex-1">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-accent btn-sm flex-1">{isSubmitting ? "Submitting..." : "Submit Application"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
