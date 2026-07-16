"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Menu, Search, Upload } from "lucide-react";

import { AuthNav, DiscordLoginButton, UserMenu } from "@/components/auth-nav";
import { useAuth } from "@/components/auth-provider";
import { LogoMark } from "@/components/icons/logo-mark";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navLinks } from "@/lib/nav-links";
import type { NotificationItem } from "@/lib/supabase/notifications";

export function SiteHeader({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/setups?q=${encodeURIComponent(trimmed)}` : "/setups");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-md bg-racing-coral/15 text-racing-coral ring-1 ring-inset ring-racing-coral/30">
            <LogoMark className="size-4" />
          </span>
          <span className="text-lg font-semibold uppercase tracking-wide">
            Setup<span className="text-racing-coral">Sheet</span>
          </span>
        </Link>

        <nav className="hidden shrink-0 items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={handleSearchSubmit} className="relative hidden min-w-0 flex-1 max-w-[220px] xl:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search track or car"
            className="h-9 pl-9"
            aria-label="Search setups"
          />
        </form>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <Button asChild size="sm">
              <Link href="/upload">
                <Upload />
                Upload Setup
              </Link>
            </Button>
          </div>

          {/* Mounted once regardless of viewport -- previously duplicated
              (one copy per breakpoint), doubling their hydration cost. */}
          <div className="flex items-center gap-1 md:ml-1 md:border-l md:border-border/80 md:pl-3">
            <NotificationBell
              initialNotifications={initialNotifications}
              initialUnreadCount={initialUnreadCount}
            />
            <AuthNav />
          </div>

          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-4/5">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 uppercase tracking-wide">
                    <LogoMark className="size-4 text-racing-coral" />
                    Setup<span className="text-racing-coral">Sheet</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4">
                  {navLinks.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <Link
                        href={link.href}
                        className="rounded-md px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
                <div className="mt-auto flex flex-col gap-2 px-4 pb-6">
                  <MobileAuthRow />
                  <SheetClose asChild>
                    <Button asChild size="lg" className="w-full">
                      <Link href="/upload">
                        <Upload />
                        Upload Setup
                      </Link>
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileAuthRow() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-10 w-full animate-pulse rounded-md bg-secondary" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border/80 px-3 py-2.5">
        <UserMenu />
        <span className="truncate text-sm font-medium">
          {user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email}
        </span>
      </div>
    );
  }

  return <DiscordLoginButton className="w-full" />;
}
