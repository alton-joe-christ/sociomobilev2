"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotifications, type Notification } from "@/context/NotificationContext";
import { useRouter } from "next/navigation";
import { BellIcon, CalendarIcon, InfoIcon, ArrowLeftIcon, XIcon, CheckIcon, TrashIcon, RefreshCwIcon, ChevronRightIcon, AlertCircleIcon } from "@/components/icons";
import { timeAgo } from "@/lib/dateUtils";
import { motion, AnimatePresence } from "framer-motion";

function typeStyle(type: string) {
  if (type === "success" || type === "event_reminder") {
    return { 
      icon: <CheckIcon size={18} color="#10B981" strokeWidth={2.5} />, 
      bg: "bg-[#ECFDF5] border border-[#D1FAE5]", 
      label: "SYSTEM"
    };
  } else if (type === "error") {
    return { 
      icon: <XIcon size={18} color="#EF4444" strokeWidth={2.5} />, 
      bg: "bg-[#FEF2F2] border border-[#FEE2E2]", 
      label: "SYSTEM"
    };
  } else if (type === "broadcast" || type === "warning") {
    return { 
      icon: <AlertCircleIcon size={18} color="#F59E0B" strokeWidth={2.5} />, 
      bg: "bg-[#FFFBEB] border border-[#FEF3C7]", 
      label: "SYSTEM"
    };
  } else {
    // Info / default
    return { 
      icon: <InfoIcon size={18} color="#2563EB" strokeWidth={2.5} />, 
      bg: "bg-[#EFF6FF] border border-[#DBEAFE]", 
      label: "SYSTEM"
    };
  }
}

function Card({
  n,
  onTap,
  onClear,
  onMarkRead,
}: {
  n: Notification;
  onTap: () => void;
  onClear: () => void;
  onMarkRead: () => void;
}) {
  const { icon, bg, label } = typeStyle(n.type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.14 }}
      drag="x"
      dragConstraints={{ left: -80, right: 0 }}
      dragElastic={0.1}
      onDragEnd={(e, info) => {
        if (info.offset.x < -40) onClear();
      }}
      className="relative mb-2 group"
    >
      <div
        className={`relative overflow-hidden transition-all active:scale-[0.99] duration-150 cursor-pointer ${
          !n.read
            ? "shadow-[0_4px_14px_rgba(1,31,123,0.08)]"
            : "opacity-88 shadow-[0_2px_6px_rgba(0,0,0,0.03)]"
        }`}
        style={{
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(226, 232, 240, 0.8)",
          borderLeft: !n.read ? "3px solid #011F7B" : "3px solid transparent",
          borderRadius: "14px",
          padding: "12px 14px",
        }}
        onClick={onTap}
      >
        <div className="w-full text-left flex gap-3">
          {/* Icon */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
            <div className="[&>svg]:w-[14px] [&>svg]:h-[14px]">{icon}</div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#011F7B]">
                  {label}
                </span>
                <span className="text-[9px] text-slate-300">·</span>
                <span className="text-[9px] text-slate-400">
                  {timeAgo(n.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#011F7B]" />}
                <ChevronRightIcon size={12} className="text-[#011F7B]/25" />
              </div>
            </div>

            <h3 className="text-[13px] font-bold text-[#0F172A] leading-snug tracking-tight">
              {n.title}
            </h3>

            <p className="text-[11px] text-[#64748B] leading-relaxed mt-0.5 line-clamp-2">
              {n.message}
            </p>

            {n.eventTitle && (
              <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0]">
                <CalendarIcon size={10} className="text-[#64748B]" />
                <span className="text-[10px] font-medium text-[#334155] truncate max-w-[130px]">
                  {n.eventTitle}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function NotificationsPage() {
  const { 
    notifications, 
    unreadCount, 
    markRead, 
    markAllRead, 
    dismiss, 
    dismissAll, 
    isLoading, 
    pushStatus, 
    triggerPrompt,
    hasMore,
    loadMore,
    refresh
  } = useNotifications();
  const router = useRouter();

  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    if (pushStatus === "not_requested") {
      triggerPrompt();
    }
  }, [pushStatus, triggerPrompt]);

  // Group notifications
  const groups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sorted = [...notifications].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const todayItems = sorted.filter(n => new Date(n.createdAt) >= today);
    const earlierItems = sorted.filter(n => new Date(n.createdAt) < today);

    return [
      { title: "Today", items: todayItems },
      { title: "Earlier", items: earlierItems },
    ].filter(g => g.items.length > 0);
  }, [notifications]);

  const handleDismissAll = async () => {
    setShowClearModal(false);
    await dismissAll();
  };

  const handleTap = (n: Notification) => {
    if (!n.read) markRead(n.id);
    if (n.eventId) router.push(`/event/${n.eventId}`);
    else if (n.actionUrl) router.push(n.actionUrl);
  };

  const handleClearOne = (n: Notification) => {
    if (!n.read) markRead(n.id);
    dismiss(n.id);
  };

  return (
    <div 
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background: "linear-gradient(180deg, #F4F7FF 0%, #EEF3FF 40%, #F8FAFC 100%)"
      }}
    >
      {/* Blueprint Grid Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(1, 31, 123, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(1, 31, 123, 0.035) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px"
        }}
      />
      {/* Subtle radial glow */}
      <div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] h-[350px] rounded-full pointer-events-none blur-[120px] opacity-10"
        style={{
          background: "radial-gradient(circle, #011F7B 0%, transparent 70%)"
        }}
      />

      {/* Background Operational Dots */}
      <div className="absolute top-[320px] left-[10%] w-1.5 h-1.5 rounded-full bg-[#011F7B]/10 pointer-events-none" />
      <div className="absolute top-[580px] right-[8%] w-2 h-2 rounded-full bg-[#011F7B]/8 pointer-events-none" />
      <div className="absolute top-[800px] left-[15%] w-1.5 h-1.5 rounded-full bg-[#011F7B]/8 pointer-events-none" />

      {/* Hero Header */}
      <div
        className="relative z-20 w-full overflow-hidden flex flex-col justify-between"
        style={{
          background: "linear-gradient(135deg, #011F7B 0%, #1E3FAB 100%)",
          height: "180px",
          paddingTop: "calc(var(--safe-top) + 10px)",
          paddingBottom: "18px",
          paddingLeft: "20px",
          paddingRight: "20px",
          borderBottomLeftRadius: "28px",
          borderBottomRightRadius: "28px",
          boxShadow: "0 8px 24px rgba(1,31,123,0.16)",
        }}
      >
        {/* Blueprint grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.35] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />
        <div className="absolute top-[60px] right-[22%] w-1 h-1 rounded-full bg-[#FFBA09] shadow-[0_0_6px_#FFBA09] opacity-60 animate-pulse pointer-events-none" />
        <div className="absolute top-[130px] right-[8%] w-1 h-1 rounded-full bg-[#FFBA09] shadow-[0_0_6px_#FFBA09] opacity-45 animate-pulse pointer-events-none" style={{ animationDelay: "1.5s" }} />

        <div className="relative z-10 flex flex-col h-full justify-between w-full">
          {/* Top row */}
          <div className="flex items-center justify-between w-full relative">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 rounded-xl bg-black/30 border border-white/15 flex items-center justify-center active:scale-95 transition-all text-white"
            >
              <ArrowLeftIcon size={15} strokeWidth={2.5} />
            </button>
            <div className="text-[15px] font-black tracking-[0.12em] text-white absolute left-1/2 -translate-x-1/2">
              SOCIO
            </div>
            <div className="w-8 h-8" />
          </div>

          {/* Title + actions row */}
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-[26px] font-extrabold tracking-tight text-white leading-none">
                Notifications
              </h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFBA09] shadow-[0_0_5px_#FFBA09]" />
                <span className="text-[11px] font-medium text-white/80">
                  {unreadCount} unread
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 pb-0.5">
              <button
                onClick={markAllRead}
                className="text-[11px] font-semibold text-white/70 active:text-white transition-colors"
              >
                Mark read
              </button>
              <span className="w-px h-3 bg-white/20" />
              <button
                onClick={() => setShowClearModal(true)}
                className="text-[11px] font-semibold text-white/70 active:text-white transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-4 pt-5 pb-40">
        {isLoading && notifications.length === 0 ? (
          <div className="space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-[72px] w-full border border-slate-200/60 skeleton"
                style={{
                  background: "rgba(255,255,255,0.6)",
                  backdropFilter: "blur(12px)",
                  borderRadius: "14px",
                }}
              />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6 relative overflow-hidden">
            <div className="absolute w-[220px] h-[220px] rounded-full border border-dashed border-[#011F7B]/5 animate-[spin_120s_linear_infinite] pointer-events-none" />
            <div className="absolute w-[160px] h-[160px] rounded-full border border-dashed border-[#011F7B]/8 animate-[spin_60s_linear_infinite] pointer-events-none" style={{ animationDirection: "reverse" }} />
            <div className="w-16 h-16 rounded-full bg-white border border-[#E2E8F0] shadow-[0_8px_24px_rgba(1,31,123,0.10)] flex items-center justify-center mb-5 relative z-10">
              <InfoIcon size={22} className="text-[#011F7B] opacity-80" />
            </div>
            <h2 className="text-[18px] font-bold text-[#011F7B] tracking-tight relative z-10">
              All caught up
            </h2>
            <p className="text-[12px] text-[#5C74A6] mt-2 max-w-[220px] leading-relaxed relative z-10">
              We&apos;ll alert you when there&apos;s new activity.
            </p>
            <button
              onClick={() => refresh()}
              className="mt-6 flex items-center gap-1.5 px-5 py-2 rounded-full bg-white border border-[#011F7B]/20 shadow-sm text-[#011F7B] font-semibold text-[11px] tracking-wider uppercase active:scale-95 transition-all relative z-10"
            >
              <RefreshCwIcon size={11} className="animate-spin-slow" />
              Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.title}>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8] pl-1 mb-2">
                  {group.title}
                </h2>
                <AnimatePresence>
                  {group.items.map((n) => (
                    <Card
                      key={n.id}
                      n={n}
                      onTap={() => handleTap(n)}
                      onClear={() => handleClearOne(n)}
                      onMarkRead={() => markRead(n.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4 pb-4">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="px-7 py-2.5 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-[#E2E8F0] text-[#0F172A] font-semibold text-[11px] uppercase tracking-[0.15em] active:scale-95 transition-transform"
                >
                  {isLoading ? "Loading…" : "Load older"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-5">
          <div 
            className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md transition-opacity" 
            onClick={() => setShowClearModal(false)}
          />
          <div 
            className="relative w-full max-w-sm bg-white/95 backdrop-blur-md rounded-[28px] p-7 shadow-[0_24px_60px_rgba(1,31,123,0.18)] border border-white/50 transform transition-all scale-100 opacity-100"
            style={{ animation: "modalEnter 400ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <div className="w-14 h-14 rounded-full bg-[#FEF2F2] border border-[#FEE2E2] flex items-center justify-center mb-5">
              <TrashIcon size={24} className="text-[#EF4444]" />
            </div>
            <h3 className="text-[20px] font-extrabold text-[#0F172A] tracking-tight mb-2">
              Clear all notifications?
            </h3>
            <p className="text-[14px] text-[#5C74A6] font-medium leading-relaxed mb-8">
              This action cannot be undone. All your current notifications will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-3.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] font-bold text-[13px] active:scale-95 transition-all uppercase tracking-wider"
              >
                Cancel
              </button>
              <button 
                onClick={handleDismissAll}
                className="flex-1 py-3.5 rounded-full bg-[#EF4444] text-white font-bold text-[13px] shadow-[0_8px_20px_rgba(239,68,68,0.25)] active:scale-95 transition-all uppercase tracking-wider"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes modalEnter {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
      `}} />
    </div>
  );
}
