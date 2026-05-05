"use client";

import { useEffect } from "react";
import { useNotifications, type Notification } from "@/context/NotificationContext";
import { useRouter } from "next/navigation";
import { BellIcon, CalendarIcon, MegaphoneIcon, InfoIcon, CheckCheckIcon, ArrowLeftIcon, XIcon, CheckIcon } from "@/components/icons";
import { Button } from "@/components/Button";
import { timeAgo } from "@/lib/dateUtils";

function typeStyle(type: string) {
  switch (type) {
    case "event_update":
    case "event_reminder":
      return { icon: <CalendarIcon size={18} />, color: "bg-blue-50 text-[var(--color-primary)]" };
    case "broadcast":
      return { icon: <MegaphoneIcon size={18} />, color: "bg-amber-50 text-[var(--color-warning)]" };
    default:
      return { icon: <InfoIcon size={18} />, color: "bg-gray-100 text-[var(--color-text-muted)]" };
  }
}

function Card({
  n,
  onTap,
  onClear,
}: {
  n: Notification;
  onTap: () => void;
  onClear: () => void;
}) {
  const { icon, color } = typeStyle(n.type);
  return (
    <div
      className={`w-full card p-4 animate-fade-up ${
        !n.read ? "border-l-[3px] border-l-[var(--color-primary)]" : ""
      }`}
    >
      <button onClick={onTap} className="w-full text-left flex gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${color}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold leading-snug">{n.title}</p>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 line-clamp-3">
            {n.message}
          </p>
          {n.eventTitle && (
            <span className="chip bg-blue-50 text-[var(--color-primary)] mt-1.5">
              {n.eventTitle}
            </span>
          )}
          <p className="text-[11px] text-[var(--color-text-light)] mt-1.5">{timeAgo(n.createdAt)}</p>
        </div>
      </button>

      <div className="mt-3 pt-2 border-t border-[var(--color-border)] flex items-center gap-2">
        <Button
          onClick={onClear}
          variant="ghost"
          size="sm"
          title="Mark read and clear"
          leftIcon={<CheckIcon size={14} />}
        >
          Mark read & Clear
        </Button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead, dismiss, dismissAll, isLoading, pushStatus, enablePushNotifications } = useNotifications();
  const router = useRouter();

  // Smart Trigger: Request permissions when user opens the notifications page
  useEffect(() => {
    if (pushStatus === "not_requested") {
      enablePushNotifications();
    }
  }, [pushStatus, enablePushNotifications]);

  const handleDismissAll = async () => {
    await dismissAll();
  };

  const handleTap = (n: Notification) => {
    if (!n.read) markRead(n.id);
    if (n.eventId) router.push(`/event/${n.eventId}`);
  };

  const handleClearOne = (n: Notification) => {
    if (!n.read) markRead(n.id);
    dismiss(n.id);
  };

  return (
    <div className="pwa-page pt-[calc(var(--nav-height)+var(--safe-top)+8px)]">
      {/* Header */}
      <div className="px-4 flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-black/5">
          <ArrowLeftIcon size={20} />
        </button>
        <h1 className="text-lg font-extrabold flex-1">Notifications</h1>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              onClick={markAllRead}
              variant="ghost"
              size="sm"
              title="Mark all as read"
              className="px-2"
            >
              <CheckCheckIcon size={14} />
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              onClick={handleDismissAll}
              variant="ghost"
              size="sm"
              title="Clear all notifications"
              className="px-2"
            >
              <XIcon size={14} />
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-20 w-full rounded-[var(--radius)]" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 animate-bounce-in">
            <BellIcon size={28} className="text-[var(--color-primary)]" />
          </div>
          <p className="text-base font-bold text-[var(--color-text)]">All caught up!</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-[240px]">
            You'll see event updates, reminders, and announcements here.
          </p>
        </div>
      ) : (
        <div className="px-4 space-y-2.5 stagger">
          {notifications.map((n) => (
            <Card
              key={n.id}
              n={n}
              onTap={() => handleTap(n)}
              onClear={() => handleClearOne(n)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
