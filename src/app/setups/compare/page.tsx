import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, GitCompare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { SetupValuesDiff } from "@/components/setup-values-diff";
import { getSetupsByIds } from "@/lib/supabase/setups";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = `Compare Setups — ${SITE_NAME}`;
const description = "Compare two setups' tuning values side by side.";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false },
  alternates: { canonical: `${SITE_URL}/setups/compare` },
  openGraph: { title, description, url: "/setups/compare", type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title, description },
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
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
                  className="truncate font-semibold hover:text-racing-coral"
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

          <Card className="px-4 py-4 sm:px-5">
            <SetupValuesDiff
              game={setupA.game}
              valuesA={setupA.setupValues}
              valuesB={setupB.setupValues}
              labelA={setupA.car}
              labelB={setupB.car}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
