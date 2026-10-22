import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComboFinder } from "@/components/combo-finder";
import { StartingPoints } from "@/components/starting-points";
import { getFinderCombos, getStartingPointCandidates } from "@/lib/supabase/setups";
import { getPublicFieldTestCounts } from "@/lib/supabase/field-tests";
import { getPendingRatingPrompts } from "@/lib/supabase/rating-prompts";
import { RatingPrompt } from "@/components/rating-prompt";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
};

/**
 * Homepage: the combo finder IS the page. No setup counts, no "8 sim titles
 * supported", no "Most upvoted" — every claim on this screen is backed by
 * real rows or by the visitor's own choices (see docs/phase-plan-2026-10-13.md).
 */
export default async function Home() {
  const [{ setups: candidates }, { combos }, supabase] = await Promise.all([
    getStartingPointCandidates(),
    getFinderCombos(),
    createClient(),
  ]);
  const user = await getCurrentUser(supabase);
  const fieldTestCounts = await getPublicFieldTestCounts(candidates.map((setup) => setup.id));
  const fieldTestCountRecord = Object.fromEntries(fieldTestCounts);
  // 24h post-download prompts (signed-in only; never for your own setups).
  const ratingPrompts = user ? await getPendingRatingPrompts() : [];

  return (
    <div className="flex flex-col">
      {/* Finder */}
      <section className="relative overflow-hidden border-b border-border/80 bg-grid">
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-20">
          <Badge
            variant="outline"
            className="gap-2 border-border/80 bg-secondary/50 px-3 py-1 text-xs text-muted-foreground"
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-muted-foreground" />
            100% free · No account to browse
          </Badge>

          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            The setup that fits your rig.
          </h1>

          <p className="max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            Find a community setup for your car, track, and hardware. Rated
            for pace, and for how predictable it feels when you are not an
            alien.
          </p>

          <ComboFinder combos={combos} />

          <ul className="flex w-full max-w-3xl list-none flex-col gap-2 text-left text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-racing-cyan" />
              Pace and Predictability, unrated until someone has run it
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-racing-cyan" />
              Filtered for your rig, not just the meta lap
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-racing-cyan" />
              Free to browse and download. No subscription
            </li>
          </ul>
        </div>
      </section>

      {/* Starting points — omitted entirely when nothing real qualifies */}
      <StartingPoints candidates={candidates} fieldTestCounts={fieldTestCountRecord} />

      {/* 24h post-download prompts — only when this signed-in visitor has
          downloads awaiting a take; omitted entirely otherwise. */}
      {ratingPrompts.length > 0 && (
        <section aria-labelledby="rating-prompts-heading" className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
          <h2 id="rating-prompts-heading" className="text-lg font-semibold">
            How did they feel?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You downloaded these — once you&apos;ve driven them, a quick take
            helps the next driver judge the evidence.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ratingPrompts.map((prompt) => (
              <RatingPrompt key={prompt.setupId} prompt={prompt} />
            ))}
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border/80 bg-card p-8 text-center sm:p-12">
          <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            Can&apos;t find the combo? Ask the community.
          </h2>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/requests">
                Request a setup
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/upload">
                <Upload />
                Upload a setup
              </Link>
            </Button>
          </div>
          {!user && (
            <p className="mt-4 text-sm text-muted-foreground">
              Sign in with Discord. No new password.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
