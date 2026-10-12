"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Menu, Search, Upload } from "lucide-react";

import { AuthNav, DiscordLoginButton, UserMenu } from "@/components/auth-nav";
import { useAuth } from "@/components/auth-provider";
import { LogoMark } from "@/components/icons/logo-mark";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { isTypingTarget } from "@/lib/is-typing-target";
import { navLinks } from "@/lib/nav-links";
import { getUserDisplayName } from "@/lib/user-display";
import type { NotificationItem } from "@/lib/supabase/notifications";

const desktopNavLinks = navLinks.filter(({ href }) => href !== "/" && href !== "/upload");
const menuNavLinks = navLinks.filter(({ href }) => href !== "/upload");

function isActiveNavLink(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/setups?q=${encodeURIComponent(trimmed)}` : "/setups");
    setOpen(false);
  }

  function focusSearch() {
    const desktopInput = searchInputRef.current;
    if (desktopInput && desktopInput.offsetParent !== null) {
      desktopInput.focus();
      return;
    }

    // The desktop search is display:none below xl. Open the mobile drawer
    // first, then focus its search field after Radix mounts the sheet content.
    setOpen(true);
    window.setTimeout(() => mobileSearchInputRef.current?.focus(), 0);
  }

  // "/" focuses this search box from anywhere on the site, same convention
  // as GitHub/Slack -- skipped while already typing somewhere else.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      focusSearch();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 2xl:max-w-7xl">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={`flex min-h-11 items-center gap-2 rounded-md font-semibold tracking-tight ${pathname === "/" ? "bg-accent/50" : ""}`}
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-racing-coral/15 text-racing-coral ring-1 ring-inset ring-racing-coral/30">
            <LogoMark className="size-4" />
          </span>
          <span className="text-lg font-semibold uppercase tracking-wide">
            Setup<span className="text-racing-coral">Sheet</span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden shrink-0 items-center gap-3 2xl:flex">
          {desktopNavLinks.map((link) => {
            const isCurrent = isActiveNavLink(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap text-sm font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <form onSubmit={handleSearchSubmit} className="relative hidden min-w-0 flex-1 max-w-sm lg:block 2xl:max-w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search track or car"
            className="pl-9 pr-8"
            aria-label="Search setups"
          />
          {!query && (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border/80 bg-secondary/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              /
            </kbd>
          )}
        </form>

        <div className="flex items-center gap-2">
          <div className="hidden xl:block">
            <Button asChild size="sm">
              <Link href="/upload">
                <Upload />
                Upload Setup
              </Link>
            </Button>
          </div>

          <div className="hidden items-center gap-1 border-l border-border/80 pl-3 2xl:flex">
            <ThemeToggle />
            {user && (
              <NotificationBell
                initialNotifications={initialNotifications}
                initialUnreadCount={initialUnreadCount}
              />
            )}
            <AuthNav />
          </div>

          <div className="2xl:hidden">
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
                <form onSubmit={handleSearchSubmit} className="px-4 pb-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={mobileSearchInputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search cars or tracks"
                      className="pl-9"
                      aria-label="Search setups"
                    />
                  </div>
                </form>
                <nav aria-label="Primary navigation" className="flex flex-col gap-1 px-4">
                  {menuNavLinks.map((link) => {
                    const isCurrent = isActiveNavLink(pathname, link.href);
                    return (
                      <SheetClose asChild key={link.href}>
                        <Link
                          href={link.href}
                          aria-current={isCurrent ? "page" : undefined}
                          className={`flex min-h-11 items-center rounded-md px-3 py-3 text-base font-medium ${isCurrent ? "bg-accent text-foreground" : "text-foreground hover:bg-accent"}`}
                        >
                          {link.label}
                        </Link>
                      </SheetClose>
                    );
                  })}
                </nav>
                <div className="mt-auto flex flex-col gap-2 px-4 pb-6">
                  <div className="flex min-h-11 items-center justify-between rounded-md border border-border/80 px-3 py-2.5">
                    <span className="text-sm font-medium">Theme</span>
                    <ThemeToggle />
                  </div>
                  <MobileAuthRow
                    initialNotifications={initialNotifications}
                    initialUnreadCount={initialUnreadCount}
                  />
                  <div className="xl:hidden">
                    <SheetClose asChild>
                      <Button asChild size="lg" className="w-full">
                        <Link href="/upload">
                          <Upload />
                          Upload Setup
                        </Link>
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileAuthRow({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-11 w-full animate-pulse rounded-md bg-secondary" />;
  }

  if (user) {
    return (
      <div className="flex min-h-11 items-center gap-3 rounded-md border border-border/80 px-3 py-2.5">
        <UserMenu />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {getUserDisplayName(user)}
        </span>
        <NotificationBell
          initialNotifications={initialNotifications}
          initialUnreadCount={initialUnreadCount}
        />
      </div>
    );
  }

  return <DiscordLoginButton className="w-full" />;
}
