import Link from "next/link";
import type { Metadata } from "next";
import { Trophy, TrendingUp, Upload } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContributorBadge } from "@/components/contributor-badge";
import { EmptyState } from "@/components/empty-state";
import { JsonLd } from "@/components/json-ld";
import { fullPageTitle } from "@/lib/seo";
import { getLeaderboard } from "@/lib/supabase/leaderboard";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { cn, getInitials } from "@/lib/utils";

const title = "Leaderboard";
const socialTitle = fullPageTitle(title);
const description = "The community's top setup contributors, ranked by total upvotes.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/leaderboard` },
  openGraph: { title: socialTitle, description, url: "/leaderboard", type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title: socialTitle, description },
};

const rankMedalClass: Record<number, string> = {
  1: "bg-racing-amber/15 text-racing-amber ring-1 ring-inset ring-racing-amber/30",
  2: "bg-secondary text-foreground ring-1 ring-inset ring-border",
  3: "bg-racing-red/10 text-racing-red/90 ring-1 ring-inset ring-racing-red/20",
};

export default async function LeaderboardPage() {
  const entries = await getLeaderboard(50);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "SetupSheet top contributors",
    description,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Person",
        name: entry.username,
        url: `${SITE_URL}/profile/${encodeURIComponent(entry.userId)}`,
      },
    })),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd data={jsonLd}/>
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl">
          <Trophy className="size-8 text-racing-amber" />
          Top Contributors
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Ranked by total upvotes earned across every setup they&apos;ve shared.
          Upload your own setups to climb the board.
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No contributors yet"
          description="Be the first to upload a setup and claim the top spot."
          action={
            <Button asChild size="sm">
              <Link href="/upload">
                <Upload />
                Upload Your Setup
              </Link>
            </Button>
          }
        />
      ) : (
        <Card as="section" aria-labelledby="leaderboard-list-heading" className="p-0">
          <h2 id="leaderboard-list-heading" className="sr-only">Contributor rankings</h2>
          <ol className="divide-y divide-border/80">
            {entries.map((entry, i) => {
              const rank = i + 1;
              return (
                <li key={entry.userId}>
                  <Link
                    href={`/profile/${encodeURIComponent(entry.userId)}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/50"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold tabular-nums",
                        rankMedalClass[rank] ?? "bg-secondary text-muted-foreground"
                      )}
                    >
                      {rank}
                    </span>

                    <Avatar className="size-10 shrink-0 ring-1 ring-border">
                      <AvatarImage src={entry.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-racing-coral/15 text-sm text-racing-coral">
                        {getInitials(entry.username)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-semibold">{entry.username}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Upload className="size-3" />
                        {entry.setupCount} {entry.setupCount === 1 ? "setup" : "setups"}
                      </span>
                    </div>

                    <ContributorBadge totalUpvotes={entry.totalUpvotes} />

                    <span className="flex shrink-0 items-center gap-1 font-mono text-lg font-semibold tabular-nums text-racing-coral">
                      <TrendingUp className="size-4" />
                      {entry.totalUpvotes}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
