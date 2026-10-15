"use client";

import { useState } from "react";
import { Bookmark, Calendar, ChevronDown, Gauge, Star, TrendingUp } from "lucide-react";

import { ScoreMeters } from "@/components/rating-bar";
import { Button } from "@/components/ui/button";
import { SCORE_DEFINITIONS_SENTENCE } from "@/lib/ratings";
import { StarRating } from "@/components/star-rating";
import type { Setup } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function SetupCardFooter({
  setup,
  upvotes,
  hasUpvoted,
  hasFavorited,
  myRating,
  isFavoritePending,
  isPending,
  onFavorite,
  onUpvote,
  onRate,
}: {
  setup: Setup;
  upvotes: number;
  hasUpvoted: boolean;
  hasFavorited: boolean;
  myRating: Setup["myRating"];
  isFavoritePending: boolean;
  isPending: boolean;
  onFavorite: () => void;
  onUpvote: () => void;
  onRate: (field: "pace" | "predictability", value: number) => void;
}) {
  const [showRateWidget, setShowRateWidget] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-t border-border/80 bg-black/15 px-5 py-3">
      {/* Rig profile + upload date */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Gauge className="size-3.5" />
          <span>{setup.rigProfile}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          <span>{formatDate(setup.uploadedAt)}</span>
        </div>
      </div>

      {/* Pace & Predictability (community average) + upvotes */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* Unrated setups render "Unrated" — no fabricated bars, no
              "be the first" bait. Rated ones show score + count per meter. */}
          <ScoreMeters
            pace={setup.pace}
            predictability={setup.predictability}
            ratingCount={setup.ratingCount}
          />
          {/* One sentence total defining the two scores (P3 detail touch) */}
          <p className="text-xs text-muted-foreground">{SCORE_DEFINITIONS_SENTENCE}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant={hasFavorited ? "secondary" : "ghost"}
            size="icon"
            onClick={onFavorite}
            disabled={isFavoritePending}
            aria-pressed={hasFavorited}
            aria-label={hasFavorited ? "Remove from saved setups" : "Save setup"}
          >
            <Bookmark className={cn("size-4", hasFavorited && "fill-current")} />
          </Button>
          <Button
            type="button"
            variant={hasUpvoted ? "secondary" : "ghost"}
            size="sm"
            onClick={onUpvote}
            disabled={isPending}
            aria-pressed={hasUpvoted}
            aria-label={
              hasUpvoted
                ? `Remove your upvote — ${upvotes} so far`
                : `Upvote this setup — ${upvotes} so far`
            }
            title={hasUpvoted ? "Remove your upvote" : "Upvote this setup"}
          >
            <TrendingUp className="size-4" />
            {/* A bare number next to an icon read as an unlabelled counter. */}
            {upvotes > 0 ? (
              <span className="text-xs font-medium">
                <span className="font-mono tabular-nums">{upvotes}</span>{" "}
                {upvotes === 1 ? "upvote" : "upvotes"}
              </span>
            ) : (
              <span className="text-xs font-medium">Upvote</span>
            )}
          </Button>
        </div>
      </div>

      {/* Rate this setup (expandable). Authors never see it: self-rating is
          blocked at the database level (0036_rating_trust.sql). */}
      {!setup.isOwner && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowRateWidget((visible) => !visible)}
            aria-expanded={showRateWidget}
            className="w-full justify-between text-left"
          >
            <span className="flex items-center gap-1.5">
              <Star className="size-3.5" />
              {myRating ? "Update your rating" : "Rate this setup"}
            </span>
            <ChevronDown
              className={cn("size-3.5 motion-safe:motion-transform", showRateWidget && "rotate-180")}
            />
          </Button>

          {showRateWidget && (
            <div className="mt-2 flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Pace</span>
                <StarRating value={myRating?.pace ?? 0} onChange={(value) => onRate("pace", value)} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Predictability</span>
                <StarRating
                  value={myRating?.predictability ?? 0}
                  onChange={(value) => onRate("predictability", value)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
