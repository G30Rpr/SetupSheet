import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, GitCompare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { SetupValuesDiff } from "@/components/setup-values-diff";
import { getSetupsByIds } from "@/lib/supabase/setups";
import { fullPageTitle } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";
import type { Setup } from "@/lib/types";

const title = "Compare Setups";
const socialTitle = fullPageTitle(title);
const description = "Compare two setups' tuning values side by side.";

/**
 * "Unparseable → say so" (P2): when a side has no structured values we can
 * line up, say precisely why instead of implying the setups match. The
 * .svm format is the known-unparsed case; anything else without values
 * simply never had them attached.
 */
function unparseableNote(setup: Setup): string | null {
  const values = setup.setupValues ?? {};
  if (Object.keys(values).length > 0) return null;
  const isSvm = (setup.fileName ?? "").toLowerCase().endsWith(".svm");
  return isSvm
    ? `${setup.car}: we can't read .svm setup files yet, so no values from this one can be lined up.`
    : `${setup.car}: no structured values attached to this setup.`;
}

function comparisonEmptyMessage(a: Setup, b: Setup): string {
  const notes = [unparseableNote(a), unparseableNote(b)].filter(Boolean);
  if (notes.length > 0) return notes.join(" ");
  return "These two setups have the same key values — nothing differs in the fields above.";
}

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  // No `alternates.canonical`: a canonical that points at a noindex page asks a
  // crawler to consolidate onto a URL it is simultaneously told to drop.
  openGraph: { title: socialTitle, description, url: "/setups/compare", type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title: socialTitle, description },
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  const ids = [a, b].filter((id): id is string => Boolean(id));
  const setups = ids.length > 0 ? await getSetupsByIds(ids) : [];

  const setupA = setups.find((s) => s.id === a);
  const setupB = setups.find((s) => s.id === b);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/setups"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground  hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Browse Setups
      </Link>

      <h1 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">Compare Setups</h1>

      {!setupA || !setupB ? (
        <EmptyState
          icon={GitCompare}
          title="Pick two setups to compare"
          description="From the Browse Setups page, turn on “Compare setups” and select two cards to see their tuning values side by side."
          action={
            <Button asChild size="sm">
              <Link href="/setups">Browse Setups</Link>
            </Button>
          }
        />
      ) : setupA.game !== setupB.game ? (
        <EmptyState
          icon={GitCompare}
          title="Setup comparison only works within the same game right now"
          description={`${setupA.car} (${setupA.game}) and ${setupB.car} (${setupB.game}) use completely different tuning screens, so there's nothing meaningful to line up.`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/setups">Back to Browse Setups</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[setupA, setupB].map((setup) => (
              <Card key={setup.id} className="gap-1.5 px-4 py-3">
                <Link
                  href={`/setups/${setup.id}`}
                  className="truncate font-semibold hover:text-foreground"
                >
                  {setup.car}
                </Link>
                <p className="truncate text-sm text-muted-foreground">{setup.track}</p>
                <p className="text-xs text-muted-foreground">
                  {setup.condition} · {setup.lapTime || "no lap time"}
                </p>
              </Card>
            ))}
          </div>

          <Card className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-base font-semibold">What&apos;s different</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Only values that differ, limited to the key setup fields: wing,
                ride height, ARB, diff, brake bias, ABS, TC, pressures. Values
                come from each setup&apos;s structured data (parsed from the
                uploaded file or entered by the author).
              </p>
            </div>

            {[setupA, setupB].map((setup) => {
              const note = unparseableNote(setup);
              return note ? (
                <p key={setup.id} className="text-xs text-muted-foreground">
                  {note}
                </p>
              ) : null;
            })}

            <SetupValuesDiff
              game={setupA.game}
              valuesA={setupA.setupValues}
              valuesB={setupB.setupValues}
              labelA={setupA.car}
              labelB={setupB.car}
              comparison
              emptyMessage={comparisonEmptyMessage(setupA, setupB)}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
