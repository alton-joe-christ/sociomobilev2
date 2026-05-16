"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotifications, type Notification } from "@/context/NotificationContext";
import { useRouter } from "next/navigation";
import { BellIcon, CalendarIcon, MegaphoneIcon, InfoIcon, ArrowLeftIcon, XIcon, CheckIcon, TrashIcon, RefreshCwIcon } from "@/components/icons";
import { timeAgo } from "@/lib/dateUtils";

function getStatusColor(type: string) {
  if (type === "event_update" || type === "event_reminder") return "#2563EB"; // Info
  if (type === "broadcast") return "#F59E0B"; // Warning
  if (type === "error") return "#EF4444"; // Error
  if (type === "success") return "#10B981"; // Success
  return "#011F7B"; // System
}

function typeStyle(type: string) {
  const color = getStatusColor(type);
  switch (type) {
    case "event_update":
    case "event_reminder":
      return { 
        icon: <CalendarIcon size={14} color={color} />, 
        colorStr: color,
        bg: "bg-blue-50/50",
        label: "EVENT"
      };
    case "broadcast":
      return { 
        icon: <MegaphoneIcon size={14} color={color} />, 
        colorStr: color,
        bg: "bg-amber-50/50",
        label: "BROADCAST"
      };
    case "success":
      return { 
        icon: <CheckIcon size={14} color={color} />, 
        colorStr: color,
        bg: "bg-emerald-50/50",
        label: "SUCCESS"
      };
    case "error":
      return { 
        icon: <XIcon size={14} color={color} />, 
        colorStr: color,
        bg: "bg-red-50/50",
        label: "ERROR"
      };
    default:
      return { 
        icon: <InfoIcon size={14} color={color} />, 
        colorStr: color,
        bg: "bg-slate-50",
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
  const { icon, colorStr, label } = typeStyle(n.type);
  
  return (
    <div
      className={`group relative overflow-hidden transition-all active:scale-[0.98] ${
        !n.read 
          ? "-translate-y-0.5 shadow-[0_10px_30px_rgba(1,31,123,0.06)] ring-1 ring-[#011F7B]/10" 
          : "opacity-95 shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
      }`}
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(226,232,240,0.9)",
        borderRadius: "24px",
        padding: "20px",
        ...( !n.read ? { borderLeft: "4px solid #011F7B" } : { borderLeft: "1px solid rgba(226,232,240,0.9)" } )
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="absolute top-4 right-4 p-2 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors z-10"
        title="Dismiss"
      >
        <XIcon size={16} />
      </button>

      {!n.read && (
        <div className="absolute top-6 right-14 w-2 h-2 rounded-full bg-[#011F7B] shadow-[0_0_8px_rgba(1,31,123,0.5)]" />
      )}

      <div onClick={onTap} className="w-full text-left cursor-pointer">
        <div className="flex gap-4">
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: colorStr }}>
                {label}
              </span>
              <span className="text-[10px] text-slate-300">•</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {timeAgo(n.createdAt)}
              </span>
            </div>
            
            <p className="text-[16px] font-bold leading-snug text-[#0F172A] tracking-tight">
              {n.title}
            </p>
            
            <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed font-medium">
              {n.message}
            </p>

            {n.eventTitle && (
              <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#F8FAFC] border border-[#E2E8F0]">
                <CalendarIcon size={12} className="text-[#011F7B]" />
                <span className="text-[11px] font-bold text-[#0F172A] truncate tracking-wide">
                  {n.eventTitle}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {!n.read && (
        <div className="pt-4 mt-2 border-t border-slate-100/50 flex items-center justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-50 text-[#011F7B] hover:bg-blue-50 transition-colors shadow-sm border border-slate-200/60"
            title="Mark as read"
          >
            <CheckIcon size={14} />
            <span className="text-[11px] font-black uppercase tracking-wider">Mark Read</span>
          </button>
        </div>
      )}
    </div>
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
    <div className="min-h-screen relative overflow-hidden" style={{
      background: "linear-gradient(180deg, #F4F7FF 0%, #EEF3FF 40%, #F8FAFC 100%)"
    }}>
      {/* Background operational layers */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Soft navy radial glow */}
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[40%] rounded-full opacity-10 blur-[80px]" style={{ background: "radial-gradient(circle, #011F7B 0%, transparent 70%)" }} />
        <div className="absolute bottom-[20%] left-[-20%] w-[70%] h-[50%] rounded-full opacity-[0.07] blur-[100px]" style={{ background: "radial-gradient(circle, #1E3FAB 0%, transparent 70%)" }} />
        {/* Subtle blueprint grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(#011F7B 1px, transparent 1px), linear-gradient(90deg, #011F7B 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }} />
        {/* Light noise texture */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "url('/noise.png')", backgroundRepeat: "repeat" }} />
      </div>

      {/* Premium Hero Header */}
      <div className="relative z-20 w-full overflow-hidden" style={{
        height: "220px",
        background: "linear-gradient(135deg, #011F7B 0%, #1E3FAB 100%)",
        borderBottomLeftRadius: "32px",
        borderBottomRightRadius: "32px",
        boxShadow: "0 10px 40px rgba(1,31,123,0.15)"
      }}>
        {/* Header background accents */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
          backgroundSize: "24px 24px"
        }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_60%)]" />

        <div className="absolute inset-0 pt-[calc(var(--safe-top)+16px)] px-5 flex flex-col justify-between pb-8">
          {/* Top Row */}
          <div className="flex items-center justify-between">
            <button 
              onClick={() => router.back()} 
              className="w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center active:scale-95 transition-transform backdrop-blur-md text-white"
            >
              <ArrowLeftIcon size={20} />
            </button>
            
            <div className="text-[18px] font-black tracking-widest text-white">
              SOCIO
            </div>

            <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md text-white relative">
              <BellIcon size={20} />
              {unreadCount > 0 && (
                <div className="absolute top-3 right-3 w-2 h-2 bg-[#FFBA09] rounded-full shadow-[0_0_8px_#FFBA09]" />
              )}
            </div>
          </div>

          {/* Second Row */}
          <div className="flex items-end justify-between mt-auto">
            <div>
              <h1 className="text-[32px] font-black tracking-tight text-white leading-none">
                Notifications
              </h1>
              <div className="flex items-center gap-3 mt-2.5">
                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFBA09] animate-pulse" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                    {unreadCount} unread
                  </span>
                </div>
                <span className="text-[11px] font-medium text-blue-200/80 uppercase tracking-wider">
                  Last synced just now
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="relative z-20 px-5 -mt-5 flex items-center justify-between gap-3">
        {unreadCount > 0 ? (
          <button
            onClick={markAllRead}
            className="flex-1 h-12 rounded-full bg-white border border-[#E2E8F0] shadow-[0_8px_20px_rgba(1,31,123,0.06)] flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <CheckIcon size={16} className="text-[#011F7B]" />
            <span className="text-[12px] font-black uppercase tracking-wider text-[#011F7B]">Mark All Read</span>
          </button>
        ) : (
          <div className="flex-1" />
        )}

        {notifications.length > 0 && (
          <button
            onClick={() => setShowClearModal(true)}
            className="flex-none px-5 h-12 rounded-full bg-white/60 backdrop-blur-md border border-[#E2E8F0] shadow-[0_8px_20px_rgba(1,31,123,0.04)] flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-red-50/50"
          >
            <TrashIcon size={16} className="text-red-500/70" />
            <span className="text-[12px] font-black uppercase tracking-wider text-[#0F172A]">Clear All</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-4 pt-6 pb-28">
        {isLoading && notifications.length === 0 ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 w-full rounded-[24px] bg-white/50 backdrop-blur-sm border border-slate-200/50 animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8 relative">
            <div className="w-24 h-24 rounded-[32px] bg-white/60 backdrop-blur-md shadow-[0_20px_40px_rgba(1,31,123,0.08)] border border-white flex items-center justify-center mb-8 relative">
              <div className="absolute inset-0 bg-[#011F7B]/5 rounded-[32px] animate-ping" style={{ animationDuration: '3s' }} />
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
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.title} className="space-y-4">
                <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-[#64748B] pl-2 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-[#64748B]/50" />
                  {group.title}
                </h2>
                <div className="space-y-3">
                  {group.items.map((n) => (
                    <div key={n.id} style={{ animation: "slideUp 180ms ease-out backwards" }}>
                      <Card
                        n={n}
                        onTap={() => handleTap(n)}
                        onClear={() => handleClearOne(n)}
                        onMarkRead={() => markRead(n.id)}
                      />
                    </div>
                  ))}
                </div>
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
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalEnter {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}} />
    </div>
  );
}
