"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Upload } from "lucide-react";

import { AuthNav, DiscordLoginButton, UserMenu } from "@/components/auth-nav";
import { useAuth } from "@/components/auth-provider";
import { LogoMark } from "@/components/icons/logo-mark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/setups", label: "Browse Setups" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/upload", label: "Upload" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-md bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30">
            <LogoMark className="size-4" />
          </span>
          <span className="text-lg">
            Setup<span className="text-racing-green">Sheet</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/setups">Browse Setups</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/upload">
              <Upload />
              Upload Setup
            </Link>
          </Button>
          <div className="ml-1 border-l border-border/80 pl-3">
            <AuthNav />
          </div>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <AuthNav />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-4/5">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <LogoMark className="size-4 text-racing-green" />
                  Setup<span className="text-racing-green">Sheet</span>
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
