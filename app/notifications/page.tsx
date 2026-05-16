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
      icon: <CheckIcon size={20} color="#10B981" />, 
      bg: "bg-[#ECFDF5]", 
      label: "SYSTEM"
    };
  } else if (type === "error") {
    return { 
      icon: <XIcon size={20} color="#EF4444" />, 
      bg: "bg-[#FEF2F2]", 
      label: "SYSTEM"
    };
  } else if (type === "broadcast" || type === "warning") {
    return { 
      icon: <AlertCircleIcon size={20} color="#F59E0B" />, 
      bg: "bg-[#FFFBEB]", 
      label: "SYSTEM"
    };
  } else {
    // Info / default
    return { 
      icon: <InfoIcon size={20} color="#2563EB" />, 
      bg: "bg-[#EFF6FF]", 
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      drag="x"
      dragConstraints={{ left: -80, right: 0 }}
      dragElastic={0.1}
      onDragEnd={(e, info) => {
        if (info.offset.x < -40) {
          onClear();
        }
      }}
      className={`relative mb-4 group`}
    >
      <div
        className={`relative overflow-hidden transition-all active:scale-[0.98] ${
          !n.read 
            ? "shadow-[0_8px_30px_rgba(1,31,123,0.08)]" 
            : "opacity-90 shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
        }`}
        style={{
          background: "rgba(255,255,255,1)",
          border: "1px solid rgba(226,232,240,0.8)",
          borderRadius: "16px",
          padding: "16px",
          ...( !n.read ? { borderLeft: "4px solid #011F7B" } : { borderLeft: "4px solid transparent" } )
        }}
        onClick={onTap}
      >
        <div className="w-full text-left cursor-pointer flex gap-3">
          {/* Left Icon */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
            {icon}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#011F7B" }}>
                  {label}
                </span>
                <span className="text-[11px] text-slate-300">•</span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {timeAgo(n.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#011F7B]/40">
                {!n.read && <div className="w-2 h-2 rounded-full bg-[#011F7B]" />}
                <ChevronRightIcon size={16} />
              </div>
            </div>
            
            <h3 className="text-[16px] font-bold text-[#0F172A] mb-1 leading-tight">
              {n.title}
            </h3>
            
            <p className="text-[14px] text-[#64748B] leading-snug font-medium mb-3">
              {n.message}
            </p>

            {(n.eventTitle || !n.read) && (
              <div className="flex items-center justify-between mt-3">
                {n.eventTitle ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F1F5F9] border border-[#E2E8F0]">
                    <CalendarIcon size={14} className="text-[#64748B]" />
                    <span className="text-[12px] font-semibold text-[#475569] truncate">
                      {n.eventTitle}
                    </span>
                  </div>
                ) : <div />}

                {!n.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 text-[#011F7B] hover:bg-blue-100 transition-colors ml-auto"
                  >
                    <CheckIcon size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Mark Read</span>
                  </button>
                )}
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
    <div className="min-h-screen relative overflow-hidden bg-[#F8FAFC]">
      {/* Background operational layers */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle blueprint grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(#011F7B 1px, transparent 1px), linear-gradient(90deg, #011F7B 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }} />
      </div>

      {/* Premium Hero Header */}
      <div className="relative z-20 w-full overflow-visible" style={{
        background: "linear-gradient(135deg, #011F7B 0%, #0c2b8c 50%, #153c9b 100%)",
        borderBottomLeftRadius: "36px",
        borderBottomRightRadius: "36px",
        paddingBottom: "36px",
        boxShadow: "0 10px 40px rgba(1,31,123,0.15)"
      }}>
        {/* Background stars / dots */}
        <div className="absolute inset-0 opacity-[0.4]" style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px)",
          backgroundSize: "30px 30px"
        }} />

        <div className="absolute inset-0 pt-[calc(var(--safe-top)+16px)] px-5 flex flex-col justify-between pb-4">
          {/* Top Row */}
          <div className="flex items-center justify-between relative z-10">
            <button 
              onClick={() => router.back()} 
              className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center active:scale-95 transition-transform backdrop-blur-md text-white"
            >
              <ArrowLeftIcon size={20} />
            </button>
            
            <div className="text-[18px] font-black tracking-widest text-white absolute left-1/2 -translate-x-1/2">
              SOCIO
            </div>

            <div className="w-10 h-10 flex items-center justify-center text-white relative">
              <BellIcon size={22} />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-[#FFBA09] text-black font-bold text-[10px] flex items-center justify-center rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </div>
          </div>

          {/* Second Row */}
          <div className="mt-6 flex flex-col gap-1.5 relative z-10">
            <h1 className="text-[34px] font-black tracking-tight text-white leading-none">
              Notifications
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBA09]" />
              <span className="text-[13px] font-medium text-white">
                {unreadCount} unread updates
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 opacity-80">
              <RefreshCwIcon size={12} className="text-white" />
              <span className="text-[12px] font-medium text-white">
                Last synced just now
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="relative z-30 px-6 flex items-center justify-center gap-4 -mt-6">
        <button
          onClick={markAllRead}
          className="flex-1 h-12 rounded-2xl bg-white shadow-[0_8px_20px_rgba(1,31,123,0.12)] flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <CheckIcon size={16} className="text-[#011F7B]" />
          <span className="text-[12px] font-bold uppercase tracking-wider text-[#011F7B]">MARK ALL AS READ</span>
        </button>

        {notifications.length > 0 && (
          <button
            onClick={() => setShowClearModal(true)}
            className="flex-1 h-12 rounded-2xl bg-white shadow-[0_8px_20px_rgba(1,31,123,0.12)] flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <TrashIcon size={16} className="text-[#EF4444]" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#EF4444]">CLEAR ALL</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-4 pt-8 pb-28">
        {isLoading && notifications.length === 0 ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 w-full rounded-[16px] bg-white border border-slate-200/50 animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8 relative">
            <div className="w-24 h-24 rounded-full bg-white shadow-[0_20px_40px_rgba(1,31,123,0.08)] flex items-center justify-center mb-8 relative">
              <BellIcon size={36} className="text-[#011F7B] opacity-80" />
            </div>
            <h2 className="text-[22px] font-black text-[#0F172A] tracking-tight">No new updates</h2>
            <p className="text-[14px] text-[#64748B] mt-2 max-w-[240px] leading-relaxed font-medium">
              You're all caught up. We'll alert you when there's operational activity.
            </p>
            <button 
              onClick={() => refresh()}
              className="mt-8 flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-[#E2E8F0] shadow-sm text-[#011F7B] font-bold text-[13px] active:scale-95 transition-all"
            >
              <RefreshCwIcon size={14} />
              REFRESH
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.title} className="space-y-3">
                <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#7088B6] pl-2 mb-2">
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
              <div className="pt-6 flex justify-center pb-6">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="px-8 py-3 rounded-full bg-white/60 backdrop-blur-sm border border-[#E2E8F0] shadow-sm text-[#0F172A] font-black text-[11px] uppercase tracking-[0.15em] active:scale-95 transition-transform"
                >
                  {isLoading ? "Loading..." : "Load Older"}
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
            className="relative w-full max-w-sm bg-white rounded-[32px] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.15)] transform transition-all scale-100 opacity-100"
            style={{ animation: "modalEnter 300ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-5 border border-red-100">
              <TrashIcon size={24} className="text-[#EF4444]" />
            </div>
            <h3 className="text-[20px] font-black text-[#0F172A] tracking-tight mb-2">
              Clear all notifications?
            </h3>
            <p className="text-[14px] text-[#64748B] font-medium leading-relaxed mb-8">
              This action cannot be undone. All your current notifications will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-3.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-bold text-[14px] active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button 
                onClick={handleDismissAll}
                className="flex-1 py-3.5 rounded-full bg-[#EF4444] text-white font-bold text-[14px] shadow-[0_8px_20px_rgba(239,68,68,0.25)] active:scale-95 transition-transform"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes modalEnter {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}} />
    </div>
  );
}
