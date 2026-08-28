"use client";

import { useState } from "react";
import { Bookmark, Calendar, ChevronDown, Gauge, Star, TrendingUp } from "lucide-react";

import { RatingBar } from "@/components/rating-bar";
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
          <div className="flex w-full items-center gap-2">
            <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
              Pace
            </span>
            <RatingBar value={setup.pace} color="coral" className="max-w-[150px]" />
          </div>
          <div className="flex w-full items-center gap-2">
            <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
              Predictability
            </span>
            <RatingBar value={setup.predictability} color="cyan" className="max-w-[150px]" />
          </div>
          <p className="pl-[102px] text-[11px] text-muted-foreground/70">
            {setup.ratingCount === 0
              ? "Not yet rated"
              : `${setup.ratingCount} ${setup.ratingCount === 1 ? "rating" : "ratings"}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onFavorite}
            disabled={isFavoritePending}
            aria-pressed={hasFavorited}
            aria-label={hasFavorited ? "Remove from saved setups" : "Save setup"}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-colors disabled:opacity-60",
              hasFavorited
                ? "bg-racing-cyan/15 text-racing-cyan ring-1 ring-inset ring-racing-cyan/40"
                : "bg-secondary text-foreground hover:bg-racing-cyan/10 hover:text-racing-cyan"
            )}
          >
            <Bookmark className={cn("size-3.5", hasFavorited && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={onUpvote}
            disabled={isPending}
            aria-pressed={hasUpvoted}
            aria-label={hasUpvoted ? "Remove upvote" : "Upvote"}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-colors disabled:opacity-60",
              hasUpvoted
                ? "bg-racing-coral/15 text-racing-coral ring-1 ring-inset ring-racing-coral/40"
                : "bg-secondary text-foreground hover:bg-racing-coral/10 hover:text-racing-coral"
            )}
          >
            <TrendingUp className="size-3.5" />
            <span className="font-mono tabular-nums">{upvotes}</span>
          </button>
        </div>
      </div>

      {/* Rate this setup (expandable) */}
      <div>
        <button
          type="button"
          onClick={() => setShowRateWidget((visible) => !visible)}
          aria-expanded={showRateWidget}
          className="flex w-full items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Star className="size-3.5" />
            {myRating ? "Update your rating" : "Rate this setup"}
          </span>
          <ChevronDown
            className={cn("size-3.5 transition-transform", showRateWidget && "rotate-180")}
          />
        </button>

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
    </div>
  );
}
