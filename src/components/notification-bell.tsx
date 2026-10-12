"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  clearReadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
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
 * Renders a static placeholder on the server and on the client's first
 * render (so hydration always agrees), then swaps in the real
 * Date.now()-relative label from a client-only effect. Computing that
 * label directly during render would risk a hydration mismatch, since
 * the server renders it at request time and the client hydrates however
 * many seconds later.
 */
function RelativeTime({ dateStr }: { dateStr: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    // The initial setState here is intentional, not derived state that
    // belongs in render: it's what makes the client-only label swap in
    // post-hydration (see the comment above), and it shares this effect
    // with the interval subscription that keeps the label fresh afterward.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel(formatRelativeTime(dateStr));
    const id = setInterval(() => setLabel(formatRelativeTime(dateStr)), 60_000);
    return () => clearInterval(id);
  }, [dateStr]);

  return <span className="text-xs text-muted-foreground">{label ?? " "}</span>;
}

/**
 * initialNotifications/initialUnreadCount come from the root layout's
 * server-side fetch (same pattern as AuthProvider's initialUser) -- no
 * realtime subscription for this first pass, so they're re-synced here
 * whenever a fresh server render passes down new values (e.g. after
 * navigating to another page), rather than only seeding state once on
 * mount and going stale for the rest of the session.
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

  // Adjusting state during render (rather than in an effect) re-syncs from
  // a fresh server render in the same pass, instead of committing the stale
  // state first and correcting it a render later.
  const [prevInitialNotifications, setPrevInitialNotifications] = useState(initialNotifications);
  if (initialNotifications !== prevInitialNotifications) {
    setPrevInitialNotifications(initialNotifications);
    setNotifications(initialNotifications);
  }
  const [prevInitialUnreadCount, setPrevInitialUnreadCount] = useState(initialUnreadCount);
  if (initialUnreadCount !== prevInitialUnreadCount) {
    setPrevInitialUnreadCount(initialUnreadCount);
    setUnreadCount(initialUnreadCount);
  }

  if (!user) return null;

  function handleItemClick(notification: NotificationItem) {
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((n) => Math.max(n - 1, 0));
      startTransition(async () => {
        try {
          const result = await markNotificationRead(notification.id);
          if (result.error) {
            toast.error(result.error);
            router.refresh();
          }
        } catch {
          toast.error("Couldn't update notifications right now.");
          router.refresh();
        }
      });
    }
    // Setup-related notifications go to the setup itself. New-setup
    // notifications go to the actor; field-test actors stay anonymous unless
    // they explicitly opted in, and have no public profile route.
    if (
      (notification.type === "request_fulfilled" ||
        notification.type === "new_comment" ||
        notification.type === "field_test") &&
      notification.setupId
    ) {
      router.push(`/setups/${notification.setupId}`);
    } else if (notification.actorId) {
      router.push(`/profile/${notification.actorId}`);
    }
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    startTransition(async () => {
      try {
        const result = await markAllNotificationsRead();
        if (result.error) {
          toast.error(result.error);
          router.refresh();
        }
      } catch {
        toast.error("Couldn't update notifications right now.");
        router.refresh();
      }
    });
  }

  function handleClearRead() {
    setNotifications((prev) => prev.filter((n) => !n.read));
    startTransition(async () => {
      try {
        const result = await clearReadNotifications();
        if (result.error) {
          toast.error(result.error);
          router.refresh();
        }
      } catch {
        toast.error("Couldn't clear notifications right now.");
        router.refresh();
      }
    });
  }

  const hasReadNotifications = notifications.some((n) => n.read);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-sm"
            >
              Mark all read
            </Button>
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
              className={cn("flex items-start gap-2.5 py-2", !n.read && "bg-accent/60")}
            >
              <Avatar className="size-8 shrink-0 ring-1 ring-border">
                <AvatarImage src={n.actorAvatarUrl ?? undefined} alt="" />
                <AvatarFallback className="bg-secondary text-xs text-muted-foreground">
                  {getInitials(n.actorUsername)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm leading-snug">
                  <span className="font-semibold">{n.actorUsername}</span>{" "}
                  {n.type === "request_fulfilled"
                    ? "fulfilled your request"
                    : n.type === "new_comment"
                      ? "commented on your setup"
                      : n.type === "field_test"
                        ? "submitted a field test for"
                        : "uploaded a new setup"}
                  {n.car ? (
                    <>
                      {" "}
                      — <span className="text-muted-foreground">{n.car}</span>
                    </>
                  ) : null}
                </p>
                <RelativeTime dateStr={n.createdAt} />
              </div>
              {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
            </DropdownMenuItem>
          ))
        )}
        {hasReadNotifications && (
          <>
            <DropdownMenuSeparator />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearRead}
              className="w-full text-sm"
            >
              Clear read notifications
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
