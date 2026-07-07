"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { cn, getInitials } from "@/lib/utils";
import type { NotificationItem } from "@/lib/supabase/notifications";

function formatRelativeTime(dateStr: string) {
  const diffMin = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

/**
 * initialNotifications/initialUnreadCount come from the root layout's
 * server-side fetch (same pattern as AuthProvider's initialUser) --
 * refreshes on the next full navigation rather than living, so a
 * notification created while this tab is already open won't appear until
 * the user navigates. No realtime subscription for this first pass.
 */
export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();

  if (!user) return null;

  function handleItemClick(notification: NotificationItem) {
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((n) => Math.max(n - 1, 0));
      startTransition(async () => {
        await markNotificationRead(notification.id);
      });
    }
    router.push(`/profile/${notification.actorId}`);
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative rounded-full p-2 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-racing-red text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No notifications yet
          </p>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onSelect={() => handleItemClick(n)}
              className={cn("flex items-start gap-2.5 py-2", !n.read && "bg-racing-green/5")}
            >
              <Avatar className="size-8 shrink-0 ring-1 ring-border">
                <AvatarImage src={n.actorAvatarUrl ?? undefined} alt={n.actorUsername} />
                <AvatarFallback className="bg-racing-green/15 text-xs text-racing-green">
                  {getInitials(n.actorUsername)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm leading-snug">
                  <span className="font-semibold">{n.actorUsername}</span> uploaded a new setup
                  {n.car ? (
                    <>
                      {" "}
                      — <span className="text-muted-foreground">{n.car}</span>
                    </>
                  ) : null}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(n.createdAt)}
                </span>
              </div>
              {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-racing-green" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
