import Link from "next/link";
import { Calendar, Star, TrendingUp, Upload, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContributorBadge } from "@/components/contributor-badge";
import { FollowButton } from "@/components/follow-button";
import { SetupCard } from "@/components/setup-card";
import { getInitials } from "@/lib/utils";
import type { Setup } from "@/lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Shared display for both the logged-in user's own /profile and anyone's
 * public /profile/[userId] -- the two differ only in the header copy/CTA
 * (self gets an "Upload Setup" shortcut and a first-person empty state;
 * a public visitor gets neither) and in how displayName/avatarUrl were
 * resolved upstream (self can fall back to Discord OAuth metadata before
 * the profiles row has synced; a public visitor just sees the profile row
 * or a not-found page, handled by the caller).
 */
export function ProfileView({
  displayName,
  avatarUrl,
  memberSince,
  followerCount,
  follow,
  setups,
  isOwnProfile,
}: {
  displayName: string;
  avatarUrl?: string;
  memberSince?: string;
  followerCount: number;
  /** Present only when viewing someone else's profile -- renders a Follow button. */
  follow?: { targetUserId: string; initialIsFollowing: boolean };
  setups: Setup[];
  isOwnProfile: boolean;
}) {
  const totalUpvotes = setups.reduce((sum, s) => sum + s.upvotes, 0);
  const totalRatings = setups.reduce((sum, s) => sum + s.ratingCount, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Card className="mb-8 flex-row flex-wrap items-center gap-5 px-5 py-6 sm:px-8">
        <Avatar className="size-16 ring-1 ring-border">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="bg-racing-green/15 text-lg text-racing-green">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">{displayName}</h1>
            <ContributorBadge totalUpvotes={totalUpvotes} />
          </div>
          {memberSince && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="size-3.5" />
              Member since {formatDate(memberSince)}
            </div>
          )}
        </div>

        {follow && (
          <FollowButton targetUserId={follow.targetUserId} initialIsFollowing={follow.initialIsFollowing} />
        )}

        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center">
            <span className="font-mono text-lg font-semibold tabular-nums">{setups.length}</span>
            <span className="text-xs text-muted-foreground">Setups</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="flex items-center gap-1 font-mono text-lg font-semibold tabular-nums text-racing-green">
              <TrendingUp className="size-4" />
              {totalUpvotes}
            </span>
            <span className="text-xs text-muted-foreground">Upvotes</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="flex items-center gap-1 font-mono text-lg font-semibold tabular-nums">
              <Star className="size-4" />
              {totalRatings}
            </span>
            <span className="text-xs text-muted-foreground">Ratings</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="flex items-center gap-1 font-mono text-lg font-semibold tabular-nums">
              <Users className="size-4" />
              {followerCount}
            </span>
            <span className="text-xs text-muted-foreground">Followers</span>
          </div>
        </div>
      </Card>

      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {isOwnProfile ? "Your Setups" : `${displayName}'s Setups`}
        </h2>
        {isOwnProfile && (
          <Button asChild size="sm">
            <Link href="/upload">
              <Upload />
              Upload Setup
            </Link>
          </Button>
        )}
      </div>

      {setups.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {setups.map((setup) => (
            <SetupCard key={setup.id} setup={setup} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 py-16 text-center">
          <p className="font-medium">
            {isOwnProfile
              ? "You haven't shared any setups yet"
              : `${displayName} hasn't shared any setups yet`}
          </p>
          {isOwnProfile && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload your first setup and it&apos;ll show up here.
              </p>
              <Button asChild size="sm">
                <Link href="/upload">Upload Your Setup</Link>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
