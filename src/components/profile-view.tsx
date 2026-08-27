import Link from "next/link";
import { Bookmark, Calendar, Star, TrendingUp, Upload, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContributorBadge } from "@/components/contributor-badge";
import { EmptyState } from "@/components/empty-state";
import { FollowButton } from "@/components/follow-button";
import { ProfileSetupsGrid } from "@/components/profile-setups-grid";
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
  setupsCapped = false,
  isOwnProfile,
  favoritedSetups,
}: {
  displayName: string;
  avatarUrl?: string;
  memberSince?: string;
  followerCount: number;
  /** Present only when viewing someone else's profile -- renders a Follow button. */
  follow?: { targetUserId: string; initialIsFollowing: boolean };
  setups: Setup[];
  /** True when the data layer hit its defensive profile-page cap. */
  setupsCapped?: boolean;
  isOwnProfile: boolean;
  /** Present only on your own profile -- favorites are private, so a public visitor never sees this section. */
  favoritedSetups?: Setup[];
}) {
  const totalUpvotes = setups.reduce((sum, s) => sum + s.upvotes, 0);
  const totalRatings = setups.reduce((sum, s) => sum + s.ratingCount, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Card className="mb-8 flex-row flex-wrap items-center gap-5 px-5 py-6 sm:px-8">
        <Avatar className="size-16 ring-1 ring-border">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="bg-racing-coral/15 text-lg text-racing-coral">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
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

        <div className="flex w-full flex-wrap items-center justify-around gap-4 sm:w-auto sm:justify-start sm:gap-5">
          <div className="flex flex-col items-center">
            <span className="font-mono text-lg font-semibold tabular-nums">{setups.length}</span>
            <span className="text-xs text-muted-foreground">Setups</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="flex items-center gap-1 font-mono text-lg font-semibold tabular-nums text-racing-coral">
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

      {setupsCapped && (
        <p className="-mt-4 mb-5 text-xs text-muted-foreground">
          Showing the most recent setups.
        </p>
      )}

      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">
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
        <ProfileSetupsGrid key={setups[0]?.id ?? "no-setups"} setups={setups} />
      ) : (
        <EmptyState
          icon={Upload}
          title={
            isOwnProfile ? "You haven't shared any setups yet" : `${displayName} hasn't shared any setups yet`
          }
          description={
            isOwnProfile
              ? "Upload your first setup and it'll show up here."
              : "Check back later — new setups show up here as soon as they're shared."
          }
          action={
            isOwnProfile && (
              <Button asChild size="sm">
                <Link href="/upload">Upload Your Setup</Link>
              </Button>
            )
          }
        />
      )}

      {favoritedSetups && favoritedSetups.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-5 flex items-center gap-1.5 text-xl font-semibold tracking-tight">
            <Bookmark className="size-4.5 fill-current text-racing-cyan" />
            Saved Setups
          </h2>
          <ProfileSetupsGrid key={favoritedSetups[0]?.id ?? "no-saved-setups"} setups={favoritedSetups} />
        </div>
      )}
    </div>
  );
}
