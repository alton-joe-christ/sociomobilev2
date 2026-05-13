"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";
import { Button } from "@/components/Button";
import {
  ChefHatIcon as ChefHat,
  CalendarIcon as CalendarDays,
  ClockIcon as Clock3,
  MapPinIcon as MapPin,
  ChevronRightIcon as ChevronRight,
  AlertTriangleIcon,
  CheckCircleIcon as CheckCircle,
  XCircleIcon as XCircle,
  ArrowLeftIcon,
  ChevronLeftIcon,
} from "@/components/icons";
import { formatDateShort, formatTime } from "@/lib/dateUtils";
import { apiRequest } from "@/lib/apiClient";

interface CateringBooking {
  booking_id: string;
  booked_by: string;
  description: string | null;
  status: "pending" | "accepted" | "declined";
  event_fest_id: string | null;
  event_fest_type: "event" | "fest" | null;
  catering_id: string;
  contact_details: any;
  created_at: string;
  event_title: string | null;
  event_date: string | null;
  fest_title: string | null;
  fest_opening_date: string | null;
  catering_name: string | null;
}

interface Vendor {
  catering_id: string;
  catering_name: string;
}

interface PaginationData {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

const DENIED_MESSAGE = "You do not have permission to access catering services";

export default function CateringDashboardPage() {
  const router = useRouter();
  const { session, userData, isLoading } = useAuth();
  const [bookings, setBookings] = useState<CateringBooking[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const pageSize = 10;

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/auth");
    }
  }, [isLoading, router, session]);

  const fetchBookings = useCallback(async (pageNum: number, tab: "pending" | "history", append = false) => {
    if (isLoading || !session?.access_token) return;

    setIsFetching(true);
    setError(null);

    const statusQuery = tab === "pending" ? "pending" : "accepted,declined";
    const vendorQuery = selectedVendorId ? `&catering_id=${selectedVendorId}` : "";

    try {
      const payload: any = await apiRequest(
        `/catering/bookings?page=${pageNum}&pageSize=${pageSize}&status=${statusQuery}${vendorQuery}`,
        {
          cache: "no-store",
        }
      );

      const newBookings = payload.bookings || [];
      setBookings((prev) => (append ? [...prev, ...newBookings] : newBookings));
      setPagination(payload.pagination || null);
      if (payload.vendors) setVendors(payload.vendors);
    } catch (err: any) {
      console.error("Failed to fetch catering bookings:", err);
      setError(err.message || "Failed to load catering orders. Please check your connection.");
    } finally {
      setIsFetching(false);
    }
  }, [isLoading, session?.access_token]);

  useEffect(() => {
    setPage(1);
    fetchBookings(1, activeTab, false);
  }, [fetchBookings, activeTab, selectedVendorId]);

  const loadMore = useCallback(() => {
    if (isFetching || !pagination || page >= pagination.totalPages) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchBookings(nextPage, activeTab, true);
  }, [isFetching, pagination, page, fetchBookings, activeTab]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const target = document.getElementById("scroll-sentinel");
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [loadMore]);

  const handleTabChange = (tab: "pending" | "history") => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      setPage(1);
      setBookings([]);
    }
  };

  const handleAction = async (bookingId: string, action: "accept" | "decline") => {
    if (!session?.access_token) return;

    try {
      await apiRequest(`/catering/bookings/${bookingId}/action`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });

      // Remove from pending tab instantly
      if (activeTab === "pending") {
        setBookings((prev) => prev.filter((b) => b.booking_id !== bookingId));
      } else {
        setBookings((prev) =>
          prev.map((b) =>
            b.booking_id === bookingId ? { ...b, status: action === "accept" ? "accepted" : "declined" } : b
          )
        );
      }
    } catch (err: any) {
      console.error(`Error performing ${action} on booking:`, err);
      alert(err.message || "Network error. Please try again.");
    }
  };

  if (isLoading || (isFetching && page === 1 && bookings.length === 0)) {
    return <LoadingScreen />;
  }

  if (!userData?.is_masteradmin && !userData?.roles?.catering) {
    return (
      <div className="pwa-page-center bg-[var(--color-bg)] px-6">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangleIcon className="text-red-500" size={32} />
        </div>
        <h1 className="text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-[var(--color-text-muted)] mb-6">{DENIED_MESSAGE}</p>
        <Button onClick={() => router.push("/profile")}>Back to Profile</Button>
      </div>
    );
  }

  return (
    <div className="pwa-page bg-[#F8FAFC]">
      {/* Sticky Sub-Header — aligns perfectly below global TopBar */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 pt-2 px-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            title="Go back"
            className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-[var(--color-text)] active:scale-90 transition-transform"
          >
            <ArrowLeftIcon size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black tracking-tight text-slate-900 leading-tight">Catering Orders</h1>
            {vendors.length > 1 ? (
              <div className="relative mt-0.5 inline-block">
                <select
                  value={selectedVendorId}
                  onChange={(e) => {
                    setSelectedVendorId(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Select catering shop"
                  title="Select catering shop"
                  className="appearance-none bg-blue-50 border-none text-[11px] font-bold text-blue-700 py-1 pl-2 pr-6 rounded-lg focus:ring-1 focus:ring-blue-200 outline-none cursor-pointer uppercase tracking-wider"
                >
                  <option value="">All Shops</option>
                  {vendors.map((v) => (
                    <option key={v.catering_id} value={v.catering_id}>
                      {v.catering_name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-blue-600">
                  <ChevronRight size={12} className="rotate-90" />
                </div>
              </div>
            ) : (
              !error && (
                <p className="text-[11px] font-bold text-[var(--color-primary)] uppercase tracking-wider">
                  {vendors[0]?.catering_name || "Vendor Dashboard"}
                </p>
              )
            )}
          </div>
        </div>

        {/* Premium Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-4">
          <button
            onClick={() => handleTabChange("pending")}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-black transition-all duration-300 ${
              activeTab === "pending"
                ? "bg-white text-blue-600 shadow-sm scale-[1.02]"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => handleTabChange("history")}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-black transition-all duration-300 ${
              activeTab === "history"
                ? "bg-white text-blue-600 shadow-sm scale-[1.02]"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            History
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 pt-6 max-w-2xl mx-auto">
        {error ? (
          <div className="bg-white rounded-2xl p-8 text-center flex flex-col items-center mt-10 shadow-sm border border-slate-100">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <AlertTriangleIcon className="text-red-500" size={28} />
            </div>
            <p className="text-[14px] font-bold text-red-600 mb-1">Failed to Load Orders</p>
            <p className="text-[12px] text-[var(--color-text-muted)] mb-6">{error}</p>
            <Button size="md" variant="primary" onClick={() => fetchBookings(page, activeTab)}>
              Retry
            </Button>
          </div>
        ) : isFetching && bookings.length === 0 ? (
          <div className="mt-20 text-center text-slate-400">
             <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
             Loading orders...
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center flex flex-col items-center mt-6 shadow-sm border border-slate-100">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              {activeTab === "pending" ? (
                <Clock3 className="text-slate-400" size={32} />
              ) : (
                <CheckCircle className="text-slate-400" size={32} />
              )}
            </div>
            <h3 className="font-bold text-[16px] text-[#0F172A] mb-1">No Orders Found</h3>
            <p className="text-[12px] text-[var(--color-text-muted)] max-w-[200px] mx-auto leading-relaxed">
              {activeTab === "pending" 
                ? "You have no pending orders to review right now." 
                : "Your past accepted and declined orders will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Group Header showing total count */}
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-[14px] font-bold text-[#475569]">
                {activeTab === "pending" ? "Action Required" : "Past Orders"}
              </h3>
              {pagination && (
                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[11px] font-bold">
                  {pagination.totalItems} Total
                </span>
              )}
            </div>

            {bookings.map((booking) => (
              <div key={booking.booking_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-blue-200 transition-colors">
                <div className="p-5">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-[16px] text-[#0F172A] leading-snug">
                        {booking.event_title || booking.fest_title || "Catering Request"}
                      </h3>
                      <p className="text-[12px] font-bold text-[var(--color-primary)] mt-0.5 tracking-tight flex items-center gap-1">
                        <ChefHat size={12} className="opacity-80" />
                        {booking.catering_name || "Unknown Shop"}
                      </p>
                       <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={12} className="text-slate-400" />
                          {booking.event_date || booking.fest_opening_date 
                            ? formatDateShort(booking.event_date || booking.fest_opening_date!) 
                            : "No Date"}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400 font-mono text-[10px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          {booking.booking_id}
                        </span>
                      </div>
                    </div>
                    
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      booking.status === "pending" ? "bg-blue-50 text-blue-600" :
                      booking.status === "accepted" ? "bg-emerald-50 text-emerald-600" :
                      "bg-rose-50 text-rose-600"
                    }`}>
                      {booking.status}
                    </div>
                  </div>

                  {/* Section: Order Details */}
                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Order Details</p>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[13px] text-slate-700 leading-relaxed">
                        {booking.description || "No specific instructions provided."}
                      </p>
                    </div>
                  </div>

                  {/* Section: Requester Info */}
                  <div className="mb-5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Requester Contact</p>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Name</p>
                          <p className="text-[12px] font-bold text-[#0F172A] truncate">
                            {booking.contact_details?.name || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Phone</p>
                          <p className="text-[12px] font-bold text-[#0F172A] truncate">
                            {booking.contact_details?.mobile || booking.contact_details?.phone || booking.contact_details?.contact_number || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Email</p>
                        <p className="text-[12px] font-medium text-slate-600 truncate">
                          {booking.contact_details?.email || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {booking.status === "pending" && (
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => handleAction(booking.booking_id, "decline")}
                        className="py-3 px-4 border border-rose-200 text-rose-600 rounded-xl text-[13px] font-bold active:bg-rose-50 transition-colors"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAction(booking.booking_id, "accept")}
                        className="py-3 px-4 bg-emerald-600 text-white rounded-xl text-[13px] font-bold shadow-sm active:scale-[0.98] transition-all"
                      >
                        Accept
                      </button>
                    </div>
                  )}
                  
                  {booking.status !== "pending" && (
                    <div className="flex items-center justify-center gap-2 py-2 text-slate-400 text-[12px] font-medium italic bg-slate-50 rounded-lg">
                      {booking.status === "accepted" ? (
                        <><CheckCircle size={14} className="text-emerald-500" /> Order accepted</>
                      ) : (
                        <><XCircle size={14} className="text-rose-500" /> Order declined</>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}            {/* Scroll Sentinel for Infinite Scroll */}
            <div id="scroll-sentinel" className="h-20 flex items-center justify-center">
              {isFetching && page > 1 && (
                <div className="animate-spin w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full"></div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
