import Link from "next/link";
import type { Metadata } from "next";
import { Trophy, TrendingUp, Upload } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ContributorBadge } from "@/components/contributor-badge";
import { getLeaderboard } from "@/lib/supabase/leaderboard";
import { cn, getInitials } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaderboard — SetupSheet",
  description: "The community's top setup contributors, ranked by total upvotes.",
};

const rankMedalClass: Record<number, string> = {
  1: "bg-racing-amber/15 text-racing-amber ring-1 ring-inset ring-racing-amber/30",
  2: "bg-secondary text-foreground ring-1 ring-inset ring-border",
  3: "bg-racing-red/10 text-red-400/90 ring-1 ring-inset ring-racing-red/20",
};

export default async function LeaderboardPage() {
  const entries = await getLeaderboard(50);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
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
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 py-16 text-center">
          <p className="font-medium">No contributors yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Be the first to upload a setup and claim the top spot.
          </p>
        </div>
      ) : (
        <Card className="divide-y divide-border/80 p-0">
          {entries.map((entry, i) => {
            const rank = i + 1;
            return (
              <Link
                key={entry.userId}
                href={`/profile/${entry.userId}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/50"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                    rankMedalClass[rank] ?? "bg-secondary text-muted-foreground"
                  )}
                >
                  {rank}
                </span>

                <Avatar className="size-10 shrink-0 ring-1 ring-border">
                  <AvatarImage src={entry.avatarUrl ?? undefined} alt={entry.username} />
                  <AvatarFallback className="bg-racing-green/15 text-sm text-racing-green">
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

                <span className="flex shrink-0 items-center gap-1 text-lg font-semibold tabular-nums text-racing-green">
                  <TrendingUp className="size-4" />
                  {entry.totalUpvotes}
                </span>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
