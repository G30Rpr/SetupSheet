import Link from "next/link";
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
import { SetupCard } from "@/components/setup-card";
import { games } from "@/lib/data";
import { getSetups } from "@/lib/supabase/setups";

const highlights = [
  {
    icon: ShieldCheck,
    title: "Safe & rated",
    description:
      "Every setup shows Pace and Predictability ratings so you know exactly what you're getting before you download.",
  },
  {
    icon: Gauge,
    title: "Built for your rig",
    description:
      "Filter by rig profile — gamepad, wheel, or direct drive — to find setups tuned for how you actually race.",
  },
  {
    icon: Users,
    title: "By racers, for racers",
    description:
      "No paywalls, no subscriptions. Just setups shared by the community, upvoted by the community.",
  },
];

export default async function Home() {
  const setups = await getSetups();
  const featured = [...setups].sort((a, b) => b.upvotes - a.upvotes).slice(0, 6);

  const stats = [
    { label: "Free setups", value: `${setups.length}` },
    { label: "Sim titles supported", value: `${games.length}` },
    { label: "Cost to browse or upload", value: "$0" },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/80 bg-grid">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-20 text-center sm:px-6 sm:py-28">
          <Badge variant="green" className="px-3 py-1 text-xs">
            100% Free · No account required to browse
          </Badge>

          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Faster laps start with the{" "}
            <span className="text-racing-green">right setup</span>
          </h1>

          <p className="max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            SetupSheet is a free community hub for sim racing setups — iRacing,
            Assetto Corsa, Le Mans Ultimate, F1 24 and more. Find a setup that
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

          <dl className="mt-6 grid w-full max-w-2xl grid-cols-3 gap-4 border-t border-border/80 pt-8">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <dt className="text-2xl font-bold text-racing-green sm:text-3xl">
                  {stat.value}
                </dt>
                <dd className="text-xs text-muted-foreground sm:text-sm">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-6 transition-colors hover:border-racing-green/40"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30">
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
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-racing-green">
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

          {featured.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((setup) => (
                <SetupCard key={setup.id} setup={setup} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 py-16 text-center">
              <p className="font-medium">No setups yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Be the first to share one — it&apos;ll show up here once it&apos;s uploaded.
              </p>
              <Button asChild size="sm">
                <Link href="/upload">
                  <Upload />
                  Upload Your Setup
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-racing-green/30 bg-gradient-to-br from-secondary to-card p-8 text-center sm:p-14">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-racing-green/20 blur-3xl" />
          <div className="relative flex flex-col items-center gap-5">
            <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              Got a setup that&apos;s fast and safe?
            </h2>
            <p className="max-w-md text-balance text-muted-foreground">
              Share it with the community in under a minute. No sign-up
              friction, just drag, drop, and race.
            </p>
            <Button asChild size="lg">
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
