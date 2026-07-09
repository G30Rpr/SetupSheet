import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Gauge,
  ShieldCheck,
  Timer,
  Upload,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { SetupCard } from "@/components/setup-card";
import { games, rigProfiles } from "@/lib/data";
import { getFeaturedSetups, getSetupCount } from "@/lib/supabase/setups";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
};

const colorClasses = {
  coral: {
    badge: "bg-racing-coral/15 text-racing-coral ring-racing-coral/30",
    hoverBorder: "hover:border-racing-coral/40",
  },
  cyan: {
    badge: "bg-racing-cyan/15 text-racing-cyan ring-racing-cyan/30",
    hoverBorder: "hover:border-racing-cyan/40",
  },
  green: {
    badge: "bg-racing-green/15 text-racing-green ring-racing-green/30",
    hoverBorder: "hover:border-racing-green/40",
  },
} as const;

const highlights = [
  {
    icon: ShieldCheck,
    title: "Safe & rated",
    description:
      "Every setup shows Pace and Predictability ratings so you know exactly what you're getting before you download.",
    color: "coral",
  },
  {
    icon: Gauge,
    title: "Built for your rig",
    description:
      "Filter by rig profile — gamepad, wheel, or direct drive — to find setups tuned for how you actually race.",
    color: "cyan",
  },
  {
    icon: Users,
    title: "By racers, for racers",
    description:
      "No paywalls, no subscriptions. Just setups shared by the community, upvoted by the community.",
    color: "green",
  },
] as const;

export default async function Home() {
  const [featured, setupCount] = await Promise.all([getFeaturedSetups(6), getSetupCount()]);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/80 bg-grid">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-20 text-center sm:px-6 sm:py-28">
          <Badge variant="outline" className="gap-2 border-border/80 bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-racing-green opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-racing-green" />
            </span>
            100% Free · No account required to browse
          </Badge>

          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Faster laps start with the{" "}
            <span className="text-racing-coral">right setup</span>
          </h1>

          <p className="max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            SetupSheet is a free community hub for sim racing setups — iRacing,
            Assetto Corsa, Le Mans Ultimate, F1 25 and more. Find a setup that
            matches your rig, your skill level, and the conditions on track.
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/setups">
                Browse Setups
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/upload">
                <Upload />
                Upload Your Setup
              </Link>
            </Button>
          </div>

          <p className="mt-6 w-full max-w-2xl border-t border-border/80 pt-8 font-mono text-xs text-muted-foreground sm:text-sm">
            {setupCount} community setups · {games.length} sim titles supported · growing every week
          </p>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className={`flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-6 transition-colors ${colorClasses[item.color].hoverBorder}`}
            >
              <span
                className={`flex size-10 items-center justify-center rounded-lg ring-1 ring-inset ${colorClasses[item.color].badge}`}
              >
                <item.icon className="size-5" />
              </span>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured setups */}
      <section className="border-t border-border/80 bg-secondary/10">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-racing-coral">
                <Timer className="size-4" />
                Trending this week
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Featured Setups
              </h2>
            </div>
            <Button asChild variant="ghost" className="w-fit">
              <Link href="/setups">
                View all setups
                <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Sim
            </span>
            {games.map((game) => (
              <Link
                key={game}
                href={`/setups?game=${encodeURIComponent(game)}`}
                className="rounded-full border border-border/80 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-racing-coral/40 hover:text-foreground"
              >
                {game}
              </Link>
            ))}
          </div>
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Rig
            </span>
            {rigProfiles.map((rig) => (
              <Link
                key={rig}
                href={`/setups?rig=${encodeURIComponent(rig)}`}
                className="rounded-full border border-border/80 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-racing-cyan/40 hover:text-foreground"
              >
                {rig}
              </Link>
            ))}
          </div>

          {featured.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((setup) => (
                <SetupCard key={setup.id} setup={setup} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Upload}
              title="No setups yet"
              description="Be the first to share one — it'll show up here once it's uploaded."
              action={
                <Button asChild size="sm">
                  <Link href="/upload">
                    <Upload />
                    Upload Your Setup
                  </Link>
                </Button>
              }
            />
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-racing-coral/30 bg-gradient-to-br from-secondary to-card p-8 text-center sm:p-14 sm:text-left">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-racing-coral/20 blur-3xl sm:left-1/4" />
          <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                Got a setup that&apos;s fast and safe?
              </h2>
              <p className="max-w-md text-balance text-muted-foreground">
                Share it with the community in under a minute. No sign-up
                friction, just drag, drop, and race.
              </p>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link href="/upload">
                <Upload />
                Upload Your Setup
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
